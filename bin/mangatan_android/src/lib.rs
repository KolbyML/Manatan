#![cfg(target_os = "android")]
use std::{
    collections::VecDeque,
    ffi::{CString, c_void},
    fs::{self, File},
    io::{self, BufReader},
    os::unix::io::FromRawFd,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicI64, Ordering},
    },
    thread,
    time::Duration,
};

use axum::{
    Json, Router,
    body::{Body, Bytes},
    extract::{
        FromRequestParts, Request, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, Method, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
};
use eframe::egui;
use flate2::read::GzDecoder;
use futures::{SinkExt, StreamExt};
use jni::{
    JavaVM,
    objects::{JObject, JString, JValue},
    signature::{Primitive, ReturnType},
    sys::{JNI_VERSION_1_6, jint, jobject},
};
use lazy_static::lazy_static;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tar::Archive;
use tokio::{fs as tokio_fs, net::TcpListener};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{
        client::IntoClientRequest,
        protocol::{Message as TungsteniteMessage, frame::coding::CloseCode},
    },
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::warn;
use tracing::{error, info, trace};
use tracing_log::LogTracer;
use tracing_subscriber::{EnvFilter, fmt::MakeWriter};
use winit::platform::android::{EventLoopBuilderExtAndroid, activity::AndroidApp};

lazy_static! {
    static ref LOG_BUFFER: Mutex<VecDeque<String>> = Mutex::new(VecDeque::with_capacity(500));
}

struct GuiWriter;
impl io::Write for GuiWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let log_line = String::from_utf8_lossy(buf).to_string();
        print!("{}", log_line);
        if let Ok(mut logs) = LOG_BUFFER.lock() {
            if logs.len() >= 500 {
                logs.pop_front();
            }
            logs.push_back(log_line);
        }
        Ok(buf.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

struct GuiMakeWriter;
impl<'a> MakeWriter<'a> for GuiMakeWriter {
    type Writer = GuiWriter;
    fn make_writer(&'a self) -> Self::Writer {
        GuiWriter
    }
}

fn start_foreground_service(app: &AndroidApp) {
    use jni::objects::{JObject, JValue};

    info!("Attempting to start Foreground Service...");

    let vm_ptr = app.vm_as_ptr() as *mut jni::sys::JavaVM;
    let vm = unsafe { JavaVM::from_raw(vm_ptr).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();

    let activity_ptr = app.activity_as_ptr() as jni::sys::jobject;
    let context = unsafe { JObject::from_raw(activity_ptr) };

    let intent_class = env
        .find_class("android/content/Intent")
        .expect("Failed to find Intent class");
    let intent = env
        .new_object(&intent_class, "()V", &[])
        .expect("Failed to create Intent");

    let context_class = env
        .find_class("android/content/Context")
        .expect("Failed to find Context class");
    let service_class_name = env
        .new_string("com.mangatan.app.MangatanService")
        .expect("Failed to create string");

    let pkg_name = get_package_name(&mut env, &context).unwrap_or("com.mangatan.app".to_string());
    let pkg_name_jstr = env.new_string(&pkg_name).unwrap();

    let _ = env
        .call_method(
            &intent,
            "setClassName",
            "(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;",
            &[
                JValue::Object(&pkg_name_jstr),
                JValue::Object(&service_class_name),
            ],
        )
        .expect("Failed to set class name on Intent");

    let sdk_int = get_android_sdk_version(app);
    if sdk_int >= 26 {
        info!("Calling startForegroundService (SDK >= 26)");
        let _ = env.call_method(
            &context,
            "startForegroundService",
            "(Landroid/content/Intent;)Landroid/content/ComponentName;",
            &[JValue::Object(&intent)],
        );
    } else {
        info!("Calling startService (SDK < 26)");
        let _ = env.call_method(
            &context,
            "startService",
            "(Landroid/content/Intent;)Landroid/content/ComponentName;",
            &[JValue::Object(&intent)],
        );
    }

    info!("Foreground Service start request sent.");
}

fn init_tracing() {
    LogTracer::init().expect("Failed to set logger");
    let filter =
        EnvFilter::new("info,mangatan_android=trace,wgpu_core=off,wgpu_hal=off,naga=off,jni=info");
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(GuiMakeWriter)
        .with_ansi(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("Failed to set tracing subscriber");
}

fn redirect_stdout_to_gui() {
    let mut pipes = [0; 2];
    if unsafe { libc::pipe(pipes.as_mut_ptr()) } < 0 {
        return;
    }
    let [read_fd, write_fd] = pipes;
    unsafe {
        libc::dup2(write_fd, libc::STDOUT_FILENO);
        libc::dup2(write_fd, libc::STDERR_FILENO);
    }
    thread::spawn(move || {
        let file = unsafe { File::from_raw_fd(read_fd) };
        let reader = BufReader::new(file);
        use std::io::BufRead;
        for line in reader.lines() {
            if let Ok(l) = line {
                if let Ok(mut logs) = LOG_BUFFER.lock() {
                    if logs.len() >= 500 {
                        logs.pop_front();
                    }
                    logs.push_back(l);
                }
            }
        }
    });
}

type JniCreateJavaVM = unsafe extern "system" fn(
    pvm: *mut *mut jni::sys::JavaVM,
    penv: *mut *mut c_void,
    args: *mut c_void,
) -> jint;

struct MangatanApp {
    server_ready: Arc<AtomicBool>,
    #[cfg(feature = "native_webview")]
    webview_launcher: Box<dyn Fn() + Send + Sync>,
    #[cfg(feature = "native_webview")]
    webview_launched: bool,
}

impl MangatanApp {
    fn new(
        _cc: &eframe::CreationContext<'_>,
        server_ready: Arc<AtomicBool>,
        #[cfg(feature = "native_webview")] webview_launcher: Box<dyn Fn() + Send + Sync>,
    ) -> Self {
        Self {
            server_ready,
            #[cfg(feature = "native_webview")]
            webview_launcher,
            #[cfg(feature = "native_webview")]
            webview_launched: false,
        }
    }
}

impl eframe::App for MangatanApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let is_ready = self.server_ready.load(Ordering::Relaxed);
        if !is_ready {
            ctx.request_repaint_after(Duration::from_millis(100));
        }

        // --- NATIVE WEBVIEW MODE ---
        #[cfg(feature = "native_webview")]
        {
            if is_ready && !self.webview_launched {
                info!("Server ready, auto-launching WebView...");
                (self.webview_launcher)();
                self.webview_launched = true;
            }

            // Render a Loading Screen WITH LOGS
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    // Reduce top spacing slightly to fit logs
                    ui.add_space(ctx.screen_rect().height() * 0.1);

                    if !is_ready {
                        ui.spinner();
                        ui.add_space(20.0);
                        ui.heading("Mangatan is starting...");
                        ui.label("Please wait while the server initializes.");
                    } else {
                        // UI in case user backs out of WebView
                        ui.heading("Mangatan is Running");
                        ui.add_space(20.0);
                        if ui.button("Return to App").clicked() {
                            (self.webview_launcher)();
                        }
                    }
                });

                // --- ADDED LOG DISPLAY HERE ---
                ui.add_space(20.0);
                ui.separator();
                ui.heading("Logs");

                egui::ScrollArea::vertical()
                    .auto_shrink([false, false])
                    .stick_to_bottom(true)
                    .show(ui, |ui| {
                        ui.style_mut().override_text_style = Some(egui::TextStyle::Monospace);
                        if let Some(style) = ui
                            .style_mut()
                            .text_styles
                            .get_mut(&egui::TextStyle::Monospace)
                        {
                            style.size = 10.0;
                        }

                        if let Ok(logs) = LOG_BUFFER.lock() {
                            for line in logs.iter() {
                                ui.label(line);
                            }
                        }
                    });
            });
            return; // Skip drawing the standard debug GUI
        }

        // --- DEBUG GUI (Only runs if feature is DISABLED) ---
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.vertical_centered(|ui| {
                ui.add_space(20.0);
                ui.heading(egui::RichText::new("Mangatan").size(32.0).strong());
                ui.add_space(20.0);

                if is_ready {
                    ui.heading(
                        egui::RichText::new("Server Started")
                            .color(egui::Color32::GREEN)
                            .strong(),
                    );
                } else {
                    ui.heading(
                        egui::RichText::new("Server is Starting...").color(egui::Color32::RED),
                    );
                    ctx.request_repaint_after(Duration::from_millis(500));
                }
                ui.add_space(20.0);

                if ui
                    .add(egui::Button::new("Open WebUI").min_size(egui::vec2(200.0, 50.0)))
                    .clicked()
                {
                    ctx.open_url(egui::OpenUrl::new_tab("http://127.0.0.1:4568"));
                    info!("User clicked Open WebUI");
                }

                ui.add_space(10.0);
                if ui
                    .add(egui::Button::new("Join our Discord").min_size(egui::vec2(200.0, 50.0)))
                    .clicked()
                {
                    ctx.open_url(egui::OpenUrl::new_tab("https://discord.gg/tDAtpPN8KK"));
                    info!("User clicked Discord");
                }
            });

            ui.add_space(20.0);
            ui.separator();
            ui.heading("Logs");

            egui::ScrollArea::vertical()
                .auto_shrink([false, false])
                .stick_to_bottom(true)
                .show(ui, |ui| {
                    ui.style_mut().override_text_style = Some(egui::TextStyle::Monospace);
                    ui.style_mut()
                        .text_styles
                        .get_mut(&egui::TextStyle::Monospace)
                        .unwrap()
                        .size = 10.0;
                    if let Ok(logs) = LOG_BUFFER.lock() {
                        for line in logs.iter() {
                            ui.label(line);
                        }
                    }
                });
        });
    }
}

#[unsafe(no_mangle)]
fn android_main(app: AndroidApp) {
    init_tracing();
    redirect_stdout_to_gui();

    info!("Starting Mangatan...");

    check_and_request_permissions(&app);

    // --- CONDITIONALLY REQUEST PERMISSIONS ---
    #[cfg(not(feature = "native_webview"))]
    {
        // Only ask for battery/notifications if we are in DEBUG/Server mode
        ensure_battery_unrestricted(&app);
    }

    // We still need locks to keep the server running
    acquire_wifi_lock(&app);
    acquire_wake_lock(&app);

    // Service ensures the process isn't killed immediately
    start_foreground_service(&app);

    let app_bg = app.clone();
    let files_dir = app.internal_data_path().expect("Failed to get data path");
    let files_dir_clone = files_dir.clone();

    let app_clone_2 = app.clone();
    let files_dir_clone_2 = files_dir.clone();

    let server_ready = Arc::new(AtomicBool::new(false));
    let server_ready_bg = server_ready.clone();
    let server_ready_gui = server_ready.clone();

    thread::spawn(move || {
        start_background_services(app_bg, files_dir);
    });

    thread::spawn(move || {
        info!("Starting Web Server Runtime...");
        let rt = tokio::runtime::Runtime::new().expect("Failed to build Tokio runtime");

        rt.spawn(async move {
            let client = reqwest::Client::new();
            let query_payload = r#"{"query": "query AllCategories { categories { nodes { mangas { nodes { title } } } } }"}"#;

            loop {
                let request = client
                    .post("http://127.0.0.1:4568/api/graphql")
                    .header("Content-Type", "application/json")
                    .body(query_payload);

                match request.send().await {
                    Ok(resp) if resp.status().is_success() || resp.status() == StatusCode::UNAUTHORIZED => {
                        if !server_ready_bg.load(Ordering::Relaxed) {
                            server_ready_bg.store(true, Ordering::Relaxed);
                            let app_clone_3 = app_clone_2.clone();
                            let files_dir_clone_3 = files_dir_clone_2.clone();
                            tokio::task::spawn_blocking(move || {
                                update_server_conf_local_source(&app_clone_3, &files_dir_clone_3);
                            });
                        }
                    }
                    _ => {
                        if server_ready_bg.load(Ordering::Relaxed) {
                            server_ready_bg.store(false, Ordering::Relaxed);
                        }
                    }
                }

                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        });

        rt.block_on(async move {
            if let Err(e) = start_web_server(files_dir_clone).await {
                error!("Web Server Crashed: {:?}", e);
            }
        });
    });

    let sdk_version = get_android_sdk_version(&app);
    info!("Detected Android SDK Version: {}", sdk_version);

    let app_gui = app.clone();
    let mut options = eframe::NativeOptions::default();

    if sdk_version <= 29 {
        info!("SDK <= 29: Forcing OpenGL (GLES) backend for maximum compatibility.");
        options.wgpu_options.supported_backends = eframe::wgpu::Backends::GL;
    } else {
        info!("SDK > 29: Programmatically detecting best graphics backend...");
        if supports_vulkan(&app) {
            info!("Vulkan supported. Using primary backend (Vulkan preferred).");
            options.wgpu_options.supported_backends = eframe::wgpu::Backends::PRIMARY;
        } else {
            info!("Vulkan not supported or check failed. Forcing OpenGL (GLES) backend.");
            options.wgpu_options.supported_backends = eframe::wgpu::Backends::GL;
        }
    }

    options.event_loop_builder = Some(Box::new(move |builder| {
        builder.with_android_app(app_gui);
    }));

    let app_for_launcher = app.clone();

    eframe::run_native(
        "Mangatan",
        options,
        Box::new(move |cc| {
            // Setup the launcher closure
            #[cfg(feature = "native_webview")]
            let launcher = Box::new(move || {
                launch_webview_activity(&app_for_launcher);
            });

            Ok(Box::new(MangatanApp::new(
                cc,
                server_ready_gui,
                #[cfg(feature = "native_webview")]
                launcher,
            )))
        }),
    )
    .unwrap_or_else(|e| {
        error!("GUI Failed to start: {:?}", e);
    });
}

fn launch_webview_activity(app: &AndroidApp) {
    use jni::objects::{JObject, JValue};

    info!("🚀 Launching Native Webview Activity...");

    let vm_ptr = app.vm_as_ptr() as *mut jni::sys::JavaVM;
    let vm = unsafe { JavaVM::from_raw(vm_ptr).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();

    let activity_ptr = app.activity_as_ptr() as jni::sys::jobject;
    let context = unsafe { JObject::from_raw(activity_ptr) };

    // Find the class we just created
    let intent_class = env
        .find_class("android/content/Intent")
        .expect("Failed to find Intent class");
    let intent = env
        .new_object(&intent_class, "()V", &[])
        .expect("Failed to create Intent");

    // Helper to get package name
    let pkg_name = get_package_name(&mut env, &context).unwrap_or("com.mangatan.app".to_string());
    let pkg_name_jstr = env.new_string(&pkg_name).unwrap();

    // Target the new Activity
    let activity_class_name = env.new_string("com.mangatan.app.WebviewActivity").unwrap();

    let _ = env
        .call_method(
            &intent,
            "setClassName",
            "(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;",
            &[
                JValue::Object(&pkg_name_jstr),
                JValue::Object(&activity_class_name),
            ],
        )
        .expect("Failed to set class name");

    let _ = env
        .call_method(
            &context,
            "startActivity",
            "(Landroid/content/Intent;)V",
            &[JValue::Object(&intent)],
        )
        .expect("Failed to start Webview Activity");
}

async fn start_web_server(data_dir: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    info!("🚀 Initializing Axum Proxy Server on port 4568...");
    let ocr_router = mangatan_ocr_server::create_router(data_dir.clone());

    #[cfg(feature = "native_webview")]
    let auto_install_yomitan = true;

    #[cfg(not(feature = "native_webview"))]
    let auto_install_yomitan = false;

    info!(
        "📚 Initializing Yomitan Server (Auto-Install: {})...",
        auto_install_yomitan
    );
    let yomitan_router =
        mangatan_yomitan_server::create_router(data_dir.clone(), auto_install_yomitan);

    let webui_dir = data_dir.join("webui");
    let client = Client::new();

    let state = AppState { client, webui_dir };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS,
            axum::http::header::ACCESS_CONTROL_REQUEST_METHOD,
        ])
        .allow_credentials(true);

    let app = Router::new()
        .route("/api/v1/webview", any(webview_shim_handler))
        .route("/api/system/version", any(current_version_handler))
        .route(
            "/api/system/download-update",
            axum::routing::post(download_update_handler),
        )
        .route("/api/system/install-update", any(install_update_handler))
        .nest_service("/api/ocr", ocr_router)
        .nest_service("/api/yomitan", yomitan_router)
        .route("/api/{*path}", any(proxy_suwayomi_handler))
        .fallback(serve_react_app)
        .layer(cors)
        .with_state(state);

    let listener = TcpListener::bind("0.0.0.0:4568").await?;
    info!("✅ Web Server listening on 0.0.0.0:4568");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn serve_react_app(State(state): State<AppState>, uri: Uri) -> impl IntoResponse {
    let path_str = uri.path().trim_start_matches('/');

    if !path_str.is_empty() {
        let file_path = state.webui_dir.join(path_str);

        if file_path.starts_with(&state.webui_dir) && file_path.exists() {
            if let Ok(content) = tokio_fs::read(&file_path).await {
                let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
                return (
                    [
                        (axum::http::header::CONTENT_TYPE, mime.as_ref()),
                        (
                            axum::http::header::CACHE_CONTROL,
                            "no-cache, no-store, must-revalidate",
                        ),
                    ],
                    content,
                )
                    .into_response();
            }
        }
    }

    let index_path = state.webui_dir.join("index.html");
    if let Ok(html_string) = tokio_fs::read_to_string(index_path).await {
        let fixed_html = html_string.replace("<head>", "<head><base href=\"/\" />");
        return (
            [
                (axum::http::header::CONTENT_TYPE, "text/html"),
                (
                    axum::http::header::CACHE_CONTROL,
                    "no-cache, no-store, must-revalidate",
                ),
            ],
            fixed_html,
        )
            .into_response();
    }

    (
        StatusCode::NOT_FOUND,
        "404 - WebUI assets not found in internal storage",
    )
        .into_response()
}

async fn proxy_suwayomi_handler(State(state): State<AppState>, req: Request) -> Response {
    let client = state.client;

    let (mut parts, body) = req.into_parts();
    let is_ws = parts
        .headers
        .get("upgrade")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("websocket"))
        .unwrap_or(false);

    if is_ws {
        let path_query = parts
            .uri
            .path_and_query()
            .map(|v| v.as_str())
            .unwrap_or(parts.uri.path());
        let backend_url = format!("ws://127.0.0.1:4567{path_query}");
        let headers = parts.headers.clone();
        let protocols: Vec<String> = parts
            .headers
            .get("sec-websocket-protocol")
            .and_then(|v| v.to_str().ok())
            .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_default();

        match WebSocketUpgrade::from_request_parts(&mut parts, &()).await {
            Ok(ws) => {
                return ws
                    .protocols(protocols)
                    .on_upgrade(move |socket| handle_socket(socket, headers, backend_url))
                    .into_response();
            }
            Err(err) => return err.into_response(),
        }
    }

    let req = Request::from_parts(parts, body);
    proxy_request(client, req, "http://127.0.0.1:4567", "").await
}

async fn handle_socket(client_socket: WebSocket, headers: HeaderMap, backend_url: String) {
    let mut request = match backend_url.clone().into_client_request() {
        Ok(req) => req,
        Err(e) => {
            error!("Invalid backend URL {}: {}", backend_url, e);
            return;
        }
    };
    for &name in &[
        "cookie",
        "authorization",
        "user-agent",
        "sec-websocket-protocol",
        "origin",
    ] {
        if let Some(value) = headers.get(name) {
            request.headers_mut().insert(name, value.clone());
        }
    }
    let (backend_socket, _) = match connect_async(request).await {
        Ok(conn) => conn,
        Err(e) => {
            error!("Backend WS connect fail: {}", e);
            return;
        }
    };
    let (mut client_sender, mut client_receiver) = client_socket.split();
    let (mut backend_sender, mut backend_receiver) = backend_socket.split();
    loop {
        tokio::select! {
            msg = client_receiver.next() => match msg {
                Some(Ok(msg)) => if let Some(t_msg) = axum_to_tungstenite(msg) {
                     if backend_sender.send(t_msg).await.is_err() { break; }
                },
                _ => break,
            },
            msg = backend_receiver.next() => match msg {
                Some(Ok(msg)) => if client_sender.send(tungstenite_to_axum(msg)).await.is_err() { break; },
                _ => break,
            }
        }
    }
}

async fn proxy_request(
    client: Client,
    req: Request,
    base_url: &str,
    strip_prefix: &str,
) -> Response {
    let path_query = req
        .uri()
        .path_and_query()
        .map(|v| v.as_str())
        .unwrap_or(req.uri().path());
    let target_path = if !strip_prefix.is_empty() && path_query.starts_with(strip_prefix) {
        &path_query[strip_prefix.len()..]
    } else {
        path_query
    };

    let target_url = format!("{base_url}{target_path}");
    let method = req.method().clone();
    let headers = req.headers().clone();
    let body = reqwest::Body::wrap_stream(req.into_body().into_data_stream());

    let mut builder = client.request(method, &target_url).body(body);
    for (key, value) in headers.iter() {
        if key.as_str() != "host" {
            builder = builder.header(key, value);
        }
    }

    match builder.send().await {
        Ok(resp) => {
            let mut response_builder = Response::builder().status(resp.status());
            for (key, value) in resp.headers() {
                response_builder = response_builder.header(key, value);
            }
            response_builder
                .body(Body::from_stream(resp.bytes_stream()))
                .unwrap()
        }
        Err(_err) => Response::builder()
            .status(StatusCode::BAD_GATEWAY)
            .body(Body::empty())
            .unwrap(),
    }
}

fn axum_to_tungstenite(msg: Message) -> Option<TungsteniteMessage> {
    match msg {
        Message::Text(t) => Some(TungsteniteMessage::Text(t.as_str().into())),
        Message::Binary(b) => Some(TungsteniteMessage::Binary(b.to_vec())),
        Message::Ping(p) => Some(TungsteniteMessage::Ping(p.to_vec())),
        Message::Pong(p) => Some(TungsteniteMessage::Pong(p.to_vec())),
        Message::Close(c) => {
            let frame = c.map(|cf| tokio_tungstenite::tungstenite::protocol::CloseFrame {
                code: CloseCode::from(cf.code),
                reason: cf.reason.to_string().into(),
            });
            Some(TungsteniteMessage::Close(frame))
        }
    }
}

fn tungstenite_to_axum(msg: TungsteniteMessage) -> Message {
    match msg {
        TungsteniteMessage::Text(t) => Message::Text(t.as_str().into()),
        TungsteniteMessage::Binary(b) => Message::Binary(b.into()),
        TungsteniteMessage::Ping(p) => Message::Ping(p.into()),
        TungsteniteMessage::Pong(p) => Message::Pong(p.into()),
        TungsteniteMessage::Close(c) => {
            let frame = c.map(|cf| axum::extract::ws::CloseFrame {
                code: u16::from(cf.code),
                reason: cf.reason.to_string().into(),
            });
            Message::Close(frame)
        }
        TungsteniteMessage::Frame(_) => Message::Binary(Bytes::new().into()),
    }
}

fn start_background_services(app: AndroidApp, files_dir: PathBuf) {
    let apk_time = get_apk_update_time(&app).unwrap_or(i64::MAX);
    let marker = files_dir.join(".extracted_apk_time");

    let last_time: i64 = fs::read_to_string(&marker)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let jre_root = files_dir.join("jre");
    let webui = files_dir.join("webui");

    if apk_time > last_time {
        info!("Extracting assets (APK updated)...");

        if jre_root.exists() {
            fs::remove_dir_all(&jre_root).ok();
        }
        if webui.exists() {
            fs::remove_dir_all(&webui).ok();
        }

        if let Err(e) = install_jre(&app, &files_dir) {
            error!("JRE extraction failed: {:?}", e);
            return;
        }

        fs::create_dir_all(&webui).ok();
        if let Err(e) = install_webui(&app, &webui) {
            error!("WebUI extraction failed: {:?}", e);
            return;
        }

        fs::write(&marker, apk_time.to_string()).ok();
        info!("Extraction complete");
    } else {
        info!("Assets up-to-date, skipping extraction");
    }

    // Create 'bin' directory to satisfy Suwayomi's directory scanner
    let bin_dir = files_dir.join("bin");
    if bin_dir.exists() {
        fs::remove_dir_all(&bin_dir).ok();
    }
    fs::create_dir_all(&bin_dir).expect("Failed to create bin directory");
    let jar_path = bin_dir.join("Suwayomi-Server.jar");

    let tachidesk_data = files_dir.join("tachidesk_data");
    let tmp_dir = files_dir.join("tmp");

    if !tachidesk_data.exists() {
        let _ = fs::create_dir_all(&tachidesk_data);
    }

    let tachi_webui_dir = tachidesk_data.join("webUI");
    if let Err(e) = fs::create_dir_all(&tachi_webui_dir) {
        error!("Failed to create tachidesk/webUI dir: {:?}", e);
    } else {
        let revision_file = tachi_webui_dir.join("revision");
        if let Err(e) = fs::write(&revision_file, "r2643") {
            error!("Failed to write revision file: {:?}", e);
        } else {
            info!("✅ Created revision file: r2643");
        }
    }

    if tmp_dir.exists() {
        let _ = fs::remove_dir_all(&tmp_dir);
    }
    if let Err(e) = fs::create_dir_all(&tmp_dir) {
        error!("Failed to create temp dir: {:?}", e);
        return;
    }
    let _ = copy_single_asset(&app, "Suwayomi-Server.jar", &jar_path);

    let lib_jli_path = find_file_in_dir(&jre_root, "libjli.so");
    if lib_jli_path.is_none() {
        error!("libjli.so missing");
        return;
    }
    let lib_jli_path = lib_jli_path.unwrap();

    let lib_jvm_path = find_file_in_dir(&jre_root, "libjvm.so");
    if lib_jvm_path.is_none() {
        error!("libjvm.so missing");
        return;
    }
    let lib_jvm_path = lib_jvm_path.unwrap();

    unsafe {
        info!("Loading JRE libraries...");

        let _lib_jli = libloading::os::unix::Library::open(
            Some(&lib_jli_path),
            libloading::os::unix::RTLD_NOW | libloading::os::unix::RTLD_GLOBAL,
        )
        .expect("Failed to load libjli.so");

        let lib_jvm = libloading::os::unix::Library::open(
            Some(&lib_jvm_path),
            libloading::os::unix::RTLD_NOW | libloading::os::unix::RTLD_GLOBAL,
        )
        .expect("Failed to load libjvm.so");

        // Preload libs
        let lib_base_dir = lib_jli_path.parent().unwrap();

        let libs_to_preload = [
            "libverify.so",
            "libjava.so",
            "libnet.so",
            "libnio.so",
            "libawt.so",
            "libawt_headless.so",
            "libjawt.so",
        ];

        for name in libs_to_preload {
            let p = lib_base_dir.join(name);
            if p.exists() {
                trace!("Preloading library: {}", name);
                if let Ok(_l) = libloading::os::unix::Library::open(
                    Some(&p),
                    libloading::os::unix::RTLD_NOW | libloading::os::unix::RTLD_GLOBAL,
                ) {
                    trace!("Loaded {}", name);
                }
            } else {
                trace!("Library not found, skipping preload: {}", name);
            }
        }

        let jar_path_abs = jar_path.canonicalize().unwrap_or(jar_path.clone());
        trace!("Classpath: {:?}", jar_path_abs);
        let mut options_vec = Vec::new();

        options_vec.push(format!("-Djava.class.path={}", jar_path_abs.display()));
        options_vec.push(format!("-Djava.home={}", jre_root.display()));
        options_vec.push(format!("-Djava.library.path={}", lib_base_dir.display()));
        options_vec.push(format!("-Djava.io.tmpdir={}", tmp_dir.display()));

        options_vec.push("-Djava.net.preferIPv4Stack=true".to_string());
        options_vec.push("-Djava.net.preferIPv6Addresses=false".to_string());
        options_vec.push("-Dos.name=Linux".to_string());
        options_vec.push("-Djava.vm.name=OpenJDK".to_string());
        options_vec.push("-Xmx512m".to_string());
        options_vec.push("-Xms256m".to_string());
        options_vec.push("-XX:TieredStopAtLevel=1".to_string());
        options_vec.push("-Dsuwayomi.tachidesk.config.server.webUIEnabled=false".to_string());
        options_vec.push("-Dsuwayomi.tachidesk.config.server.kcefEnable=false".to_string());
        options_vec.push("-Dsuwayomi.tachidesk.config.server.enableCookieApi=true".to_string());
        options_vec.push(
            "-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false".to_string(),
        );
        options_vec.push("-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false".to_string());
        options_vec.push(
            "-Dsuwayomi.tachidesk.config.server.rootDir={}"
                .to_string()
                .replace("{}", &tachidesk_data.to_string_lossy()),
        );

        let config_marker = files_dir.join(".config_local_source_v1");
        let server_conf_exists = tachidesk_data.join("server.conf").exists();

        if !config_marker.exists() {
            info!(
                "Configuration check: Existing User = {}",
                server_conf_exists
            );

            let android_vm = JavaVM::from_raw(app.vm_as_ptr() as *mut jni::sys::JavaVM).unwrap();
            match android_vm.attach_current_thread() {
                Ok(mut android_env) => {
                    let env_cls = android_env.find_class("android/os/Environment").unwrap();
                    let dir_obj = android_env
                        .call_static_method(
                            env_cls,
                            "getExternalStorageDirectory",
                            "()Ljava/io/File;",
                            &[],
                        )
                        .unwrap()
                        .l()
                        .unwrap();
                    let path_obj = android_env
                        .call_method(&dir_obj, "getAbsolutePath", "()Ljava/lang/String;", &[])
                        .unwrap()
                        .l()
                        .unwrap();
                    let path_jstr: JString = path_obj.into();
                    let path_rust: String = android_env.get_string(&path_jstr).unwrap().into();

                    let target_path = format!("{}/Mangatan/local-sources", path_rust);
                    info!("Ensuring local source directory exists: {}", target_path);
                    let _ = std::fs::create_dir_all(&target_path);

                    let nomedia_path = format!("{target_path}/.nomedia");
                    if !std::path::Path::new(&nomedia_path).exists() {
                        if let Err(err) = std::fs::File::create(&nomedia_path) {
                            error!("Failed to create .nomedia in local-sources: {err:?}");
                        } else {
                            info!("✅ Created .nomedia in local-sources");
                        }
                    }

                    if !server_conf_exists {
                        info!("Fresh install detected: Setting localSourcePath flag.");
                        options_vec.push(format!(
                            "-Dsuwayomi.tachidesk.config.server.localSourcePath={}",
                            target_path
                        ));

                        // --- IMPORTANT: Create pending marker HERE ---
                        // This ensures we only patch server.conf if this specific code block runs.
                        let pending_marker = files_dir.join(".pending_local_source_config");
                        let _ = File::create(&pending_marker);
                    } else {
                        info!("Legacy update detected: NOT setting localSourcePath flag.");
                    }

                    if let Err(e) = std::fs::write(&config_marker, "configured") {
                        error!("Failed to write config marker: {:?}", e);
                    }
                }
                Err(e) => error!(
                    "Failed to attach to Android VM for path resolution: {:?}",
                    e
                ),
            }
        } else {
            info!("Config marker exists. Skipping localSourcePath configuration.");
        }

        let mut jni_options: Vec<jni::sys::JavaVMOption> = options_vec
            .iter()
            .map(|s| {
                let cstr = CString::new(s.as_str()).unwrap();
                jni::sys::JavaVMOption {
                    optionString: cstr.into_raw(),
                    extraInfo: std::ptr::null_mut(),
                }
            })
            .collect();

        info!("Creating JVM with {} options", jni_options.len());

        let create_vm_fn = lib_jvm
            .get::<JniCreateJavaVM>(b"JNI_CreateJavaVM\0")
            .unwrap();
        let mut vm_args = jni::sys::JavaVMInitArgs {
            version: JNI_VERSION_1_6,
            nOptions: jni_options.len() as i32,
            options: jni_options.as_mut_ptr(),
            ignoreUnrecognized: 1,
        };

        info!("Calling JNI_CreateJavaVM...");
        let mut jvm: *mut jni::sys::JavaVM = std::ptr::null_mut();
        let mut env: *mut c_void = std::ptr::null_mut();
        let result = create_vm_fn(&mut jvm, &mut env, &mut vm_args as *mut _ as *mut c_void);

        if result != 0 {
            error!("Failed to create Java VM: {}", result);
            return;
        }
        trace!("JVM Created Successfully");

        let jvm_wrapper = JavaVM::from_raw(jvm).unwrap();
        let mut env = jvm_wrapper.attach_current_thread().unwrap();

        info!("Finding Main Class...");
        let jar_file_cls = env.find_class("java/util/jar/JarFile").unwrap();
        let mid_jar_init = env
            .get_method_id(&jar_file_cls, "<init>", "(Ljava/lang/String;)V")
            .unwrap();
        let mid_get_manifest = env
            .get_method_id(&jar_file_cls, "getManifest", "()Ljava/util/jar/Manifest;")
            .unwrap();
        let jar_path_str = env.new_string(jar_path_abs.to_str().unwrap()).unwrap();

        let jar_obj = match env.new_object_unchecked(
            &jar_file_cls,
            mid_jar_init,
            &[JValue::Object(&jar_path_str).as_jni()],
        ) {
            Ok(o) => o,
            Err(e) => {
                error!("Error opening JAR: {:?}", e);
                let _ = env.exception_describe();
                return;
            }
        };

        let manifest_obj = env
            .call_method_unchecked(jar_obj, mid_get_manifest, ReturnType::Object, &[])
            .unwrap()
            .l()
            .unwrap();
        let manifest_cls = env.find_class("java/util/jar/Manifest").unwrap();
        let mid_get_attrs = env
            .get_method_id(
                manifest_cls,
                "getMainAttributes",
                "()Ljava/util/jar/Attributes;",
            )
            .unwrap();
        let attrs_obj = env
            .call_method_unchecked(manifest_obj, mid_get_attrs, ReturnType::Object, &[])
            .unwrap()
            .l()
            .unwrap();
        let attrs_cls = env.find_class("java/util/jar/Attributes").unwrap();
        let mid_get_val = env
            .get_method_id(
                attrs_cls,
                "getValue",
                "(Ljava/lang/String;)Ljava/lang/String;",
            )
            .unwrap();
        let key_str = env.new_string("Main-Class").unwrap();
        let main_class_jstr = env
            .call_method_unchecked(
                attrs_obj,
                mid_get_val,
                ReturnType::Object,
                &[JValue::Object(&key_str).as_jni()],
            )
            .unwrap()
            .l()
            .unwrap();

        let main_class_name: String = env.get_string(&main_class_jstr.into()).unwrap().into();
        // FIX 1: Trim whitespace, just in case the Manifest has hidden spaces
        let main_class_path = main_class_name.trim().replace(".", "/");
        info!("Found Main: '{}'", main_class_path);

        // --- REPLACE THE CRASHING BLOCK WITH THIS ---

        // 1. Try to find the Main Class safely
        let main_class = match env.find_class(&main_class_path) {
            Ok(cls) => cls,
            Err(e) => {
                error!(
                    "❌ CRITICAL: JVM could not load Main Class: {}",
                    main_class_path
                );
                // This prints the actual Java error (e.g. ClassNotFoundException) to the logs
                let _ = env.exception_describe();
                return;
            }
        };

        // 2. Try to find the 'main' method safely
        let main_method_id = match env.get_static_method_id(
            &main_class,
            "main",
            "([Ljava/lang/String;)V",
        ) {
            Ok(mid) => mid,
            Err(e) => {
                error!(
                    "❌ CRITICAL: Found class, but could not find 'static void main(String[] args)'"
                );
                let _ = env.exception_describe();
                return;
            }
        };

        // 3. Create the arguments array safely
        let empty_str_array = match env.new_object_array(0, "java/lang/String", JObject::null()) {
            Ok(arr) => arr,
            Err(e) => {
                error!("❌ CRITICAL: Failed to create args array");
                let _ = env.exception_describe();
                return;
            }
        };

        info!("Invoking Main...");
        if let Err(e) = env.call_static_method_unchecked(
            &main_class,
            main_method_id,
            ReturnType::Primitive(Primitive::Void),
            &[JValue::Object(&empty_str_array).as_jni()],
        ) {
            error!("Crash in Main: {:?}", e);
            let _ = env.exception_describe();
        }
    }
}

fn install_webui(app: &AndroidApp, target_dir: &Path) -> std::io::Result<()> {
    let filename = CString::new("mangatan-webui.tar").unwrap();

    let asset = app
        .asset_manager()
        .open(&filename)
        .ok_or(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "mangatan-webui.tar missing in assets",
        ))?;

    let mut archive = Archive::new(BufReader::new(asset));
    archive.unpack(target_dir)?;
    info!("WebUI extracted successfully to {:?}", target_dir);
    Ok(())
}

fn install_jre(app: &AndroidApp, target_dir: &Path) -> std::io::Result<()> {
    let filename = CString::new("jre.tar.gz").unwrap();

    let asset = app
        .asset_manager()
        .open(&filename)
        .ok_or(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "jre.tar.gz missing",
        ))?;

    let decoder = GzDecoder::new(BufReader::new(asset));
    let mut archive = Archive::new(decoder);

    archive.unpack(target_dir)?;
    Ok(())
}

fn copy_single_asset(
    app: &AndroidApp,
    asset_name: &str,
    target_path: &Path,
) -> std::io::Result<()> {
    let c_path = CString::new(asset_name).unwrap();
    if let Some(mut asset) = app.asset_manager().open(&c_path) {
        let mut out = File::create(target_path)?;
        std::io::copy(&mut asset, &mut out)?;
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            asset_name,
        ))
    }
}

fn find_file_in_dir(dir: &Path, filename: &str) -> Option<PathBuf> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(found) = find_file_in_dir(&path, filename) {
                    return Some(found);
                }
            } else if let Some(name) = path.file_name() {
                if name == filename {
                    return Some(path);
                }
            }
        }
    }
    None
}

#[derive(Clone)]
struct AppState {
    client: Client,
    webui_dir: PathBuf,
}

fn ensure_battery_unrestricted(app: &AndroidApp) {
    use jni::objects::{JObject, JValue};

    let vm_ptr = app.vm_as_ptr() as *mut jni::sys::JavaVM;
    let vm = unsafe { JavaVM::from_raw(vm_ptr).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();

    let activity_ptr = app.activity_as_ptr() as jni::sys::jobject;
    let context = unsafe { JObject::from_raw(activity_ptr) };

    let pkg_name_jstr = env
        .call_method(&context, "getPackageName", "()Ljava/lang/String;", &[])
        .unwrap()
        .l()
        .unwrap();
    let pkg_name_string: String = env.get_string((&pkg_name_jstr).into()).unwrap().into();

    let power_service_str = env.new_string("power").unwrap();
    let power_manager = env
        .call_method(
            &context,
            "getSystemService",
            "(Ljava/lang/String;)Ljava/lang/Object;",
            &[JValue::Object(&power_service_str)],
        )
        .unwrap()
        .l()
        .unwrap();

    let is_ignoring = env
        .call_method(
            &power_manager,
            "isIgnoringBatteryOptimizations",
            "(Ljava/lang/String;)Z",
            &[JValue::Object(&pkg_name_jstr)],
        )
        .unwrap()
        .z()
        .unwrap();

    if is_ignoring {
        info!("Battery optimization is already unrestricted.");
        return;
    }

    info!("Requesting removal of battery optimizations...");

    let action_str = env
        .new_string("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS")
        .unwrap();

    let intent_class = env.find_class("android/content/Intent").unwrap();
    let intent = env
        .new_object(
            &intent_class,
            "(Ljava/lang/String;)V",
            &[JValue::Object(&action_str)],
        )
        .unwrap();

    let uri_class = env.find_class("android/net/Uri").unwrap();
    let uri_str = env
        .new_string(format!("package:{}", pkg_name_string))
        .unwrap();
    let uri = env
        .call_static_method(
            &uri_class,
            "parse",
            "(Ljava/lang/String;)Landroid/net/Uri;",
            &[JValue::Object(&uri_str)],
        )
        .unwrap()
        .l()
        .unwrap();

    let _ = env
        .call_method(
            &intent,
            "setData",
            "(Landroid/net/Uri;)Landroid/content/Intent;",
            &[JValue::Object(&uri)],
        )
        .unwrap();

    let _ = env
        .call_method(
            &context,
            "startActivity",
            "(Landroid/content/Intent;)V",
            &[JValue::Object(&intent)],
        )
        .unwrap();

    info!("Battery exemption dialog requested.");
}

fn get_package_name(env: &mut jni::JNIEnv, context: &JObject) -> jni::errors::Result<String> {
    let package_jstr_obj = env
        .call_method(context, "getPackageName", "()Ljava/lang/String;", &[])?
        .l()?;

    let package_jstr: JString = package_jstr_obj.into();

    let rust_string: String = env.get_string(&package_jstr)?.into();

    Ok(rust_string)
}
fn supports_vulkan(app: &AndroidApp) -> bool {
    let vm = unsafe { JavaVM::from_raw(app.vm_as_ptr() as *mut jni::sys::JavaVM).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();
    let context = unsafe { JObject::from_raw(app.activity_as_ptr() as jni::sys::jobject) };
    let pm = env
        .call_method(
            &context,
            "getPackageManager",
            "()Landroid/content/pm/PackageManager;",
            &[],
        )
        .unwrap()
        .l()
        .unwrap();
    let pm_class = env.find_class("android/content/pm/PackageManager").unwrap();
    let feature_str = env
        .get_static_field(
            &pm_class,
            "FEATURE_VULKAN_HARDWARE_VERSION",
            "Ljava/lang/String;",
        )
        .unwrap()
        .l()
        .unwrap();
    let vulkan_1_1_version_code = 0x401000;
    let supported = env
        .call_method(
            &pm,
            "hasSystemFeature",
            "(Ljava/lang/String;I)Z",
            &[
                JValue::Object(&feature_str),
                JValue::Int(vulkan_1_1_version_code),
            ],
        )
        .unwrap()
        .z()
        .unwrap_or(false);
    info!("Vulkan 1.1+ hardware support detected: {}", supported);
    supported
}
fn get_android_sdk_version(app: &AndroidApp) -> i32 {
    let vm_ptr = app.vm_as_ptr() as *mut jni::sys::JavaVM;
    let vm = unsafe { JavaVM::from_raw(vm_ptr).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();

    let version_cls = env
        .find_class("android/os/Build$VERSION")
        .expect("Failed to find Build$VERSION");
    let sdk_int = env
        .get_static_field(version_cls, "SDK_INT", "I")
        .expect("Failed to get SDK_INT")
        .i()
        .unwrap_or(0);

    sdk_int
}

fn check_and_request_permissions(app: &AndroidApp) {
    // 1. Initialize JNI Environment and Context
    let vm = unsafe { JavaVM::from_raw(app.vm_as_ptr() as *mut jni::sys::JavaVM).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();

    // The AndroidApp context is the activity (jobject) itself.
    let context = unsafe { JObject::from_raw(app.activity_as_ptr() as jobject) };

    // Get the package name using JNI
    let pkg_name = match get_package_name(&mut env, &context) {
        Ok(name) => name,
        Err(e) => {
            info!("Failed to get package name via JNI: {:?}", e);
            "com.mangatan.app".to_string()
        }
    };
    info!("Using Package Name: {}", pkg_name);

    // 2. Get Android SDK Version
    let version_cls = env.find_class("android/os/Build$VERSION").unwrap();
    let sdk_int = env
        .get_static_field(version_cls, "SDK_INT", "I")
        .unwrap()
        .i()
        .unwrap();

    info!("Detected Android SDK: {}", sdk_int);

    if sdk_int >= 33 {
        let notif_perm = env
            .new_string("android.permission.POST_NOTIFICATIONS")
            .unwrap();

        let check_res = env
            .call_method(
                &context,
                "checkSelfPermission",
                "(Ljava/lang/String;)I",
                &[JValue::Object(&notif_perm)],
            )
            .unwrap()
            .i()
            .unwrap();

        if check_res != 0 {
            // 0 = PERMISSION_GRANTED, -1 = PERMISSION_DENIED
            info!("Requesting Notification Permissions (Android 13+)...");

            let string_cls = env.find_class("java/lang/String").unwrap();
            let perms_array = env
                .new_object_array(1, string_cls, JObject::null())
                .unwrap();

            env.set_object_array_element(&perms_array, 0, notif_perm)
                .unwrap();

            // Request code 102 for notifications
            let _ = env.call_method(
                &context,
                "requestPermissions",
                "([Ljava/lang/String;I)V",
                &[JValue::Object(&perms_array), JValue::Int(102)],
            );
        } else {
            info!("Notification permissions already granted.");
        }
    }

    if sdk_int >= 30 {
        // --- Android 11+ (SDK 30+) Logic: Manage All Files ---
        let env_cls = env.find_class("android/os/Environment").unwrap();
        let is_manager = env
            .call_static_method(env_cls, "isExternalStorageManager", "()Z", &[])
            .unwrap()
            .z()
            .unwrap();

        if !is_manager {
            info!("Requesting Android 11+ All Files Access...");
            let uri_cls = env.find_class("android/net/Uri").unwrap();

            // Construct "package:com.your.package"
            let uri_str = env.new_string(format!("package:{}", pkg_name)).unwrap();

            let uri = env
                .call_static_method(
                    uri_cls,
                    "parse",
                    "(Ljava/lang/String;)Landroid/net/Uri;",
                    &[JValue::Object(&uri_str)],
                )
                .unwrap()
                .l()
                .unwrap();

            let intent_cls = env.find_class("android/content/Intent").unwrap();
            let action = env
                .new_string("android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION")
                .unwrap();

            let intent = env
                .new_object(
                    intent_cls,
                    "(Ljava/lang/String;Landroid/net/Uri;)V",
                    &[JValue::Object(&action), JValue::Object(&uri)],
                )
                .unwrap();

            let flags = 0x10000000; // FLAG_ACTIVITY_NEW_TASK
            let _ = env.call_method(
                &intent,
                "addFlags",
                "(I)Landroid/content/Intent;",
                &[JValue::Int(flags)],
            );

            let _ = env.call_method(
                &context,
                "startActivity",
                "(Landroid/content/Intent;)V",
                &[JValue::Object(&intent)],
            );
        }
    } else {
        // --- Android 8.0 - 10 (SDK 26-29) Logic: Standard Permissions ---

        let perm_string = env
            .new_string("android.permission.WRITE_EXTERNAL_STORAGE")
            .unwrap();

        // Check if already granted
        let check_res = env
            .call_method(
                &context,
                "checkSelfPermission",
                "(Ljava/lang/String;)I",
                &[JValue::Object(&perm_string)],
            )
            .unwrap()
            .i()
            .unwrap();

        if check_res != 0 {
            info!("Requesting Legacy Storage Permissions (SDK < 30)...");

            let string_cls = env.find_class("java/lang/String").unwrap();

            let perms_array = env
                .new_object_array(2, string_cls, JObject::null())
                .unwrap();
            let write_perm = env
                .new_string("android.permission.WRITE_EXTERNAL_STORAGE")
                .unwrap();
            let read_perm = env
                .new_string("android.permission.READ_EXTERNAL_STORAGE")
                .unwrap();

            env.set_object_array_element(&perms_array, 0, write_perm)
                .unwrap();
            env.set_object_array_element(&perms_array, 1, read_perm)
                .unwrap();

            // Call activity.requestPermissions(String[], int)
            let _ = env.call_method(
                &context,
                "requestPermissions",
                "([Ljava/lang/String;I)V",
                &[JValue::Object(&perms_array), JValue::Int(101)],
            );
        } else {
            info!("Legacy Storage Permissions already granted.");
        }
    }
}

fn acquire_wifi_lock(app: &AndroidApp) {
    use jni::objects::{JObject, JValue};

    info!("Acquiring WifiLock...");
    let vm_ptr = app.vm_as_ptr() as *mut jni::sys::JavaVM;
    let vm = unsafe { JavaVM::from_raw(vm_ptr).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();

    let activity_ptr = app.activity_as_ptr() as jni::sys::jobject;
    let context = unsafe { JObject::from_raw(activity_ptr) };

    // 1. Get WifiManager
    let wifi_service_str = env.new_string("wifi").unwrap();
    let wifi_manager = env
        .call_method(
            &context,
            "getSystemService",
            "(Ljava/lang/String;)Ljava/lang/Object;",
            &[JValue::Object(&wifi_service_str)],
        )
        .unwrap()
        .l()
        .unwrap();

    // 2. Create Lock (Mode 3 = WIFI_MODE_FULL_HIGH_PERF)
    let tag = env.new_string("Mangatan:WifiLock").unwrap();
    let wifi_lock = env
        .call_method(
            &wifi_manager,
            "createWifiLock",
            "(ILjava/lang/String;)Landroid/net/wifi/WifiManager$WifiLock;",
            &[JValue::Int(3), JValue::Object(&tag)],
        )
        .unwrap()
        .l()
        .unwrap();

    // 3. Acquire
    let _ = env.call_method(&wifi_lock, "acquire", "()V", &[]);

    // 4. Release Reference (Java keeps the lock object alive)
    let _ = env.new_global_ref(&wifi_lock).unwrap();

    info!("✅ WifiLock Acquired!");
}

fn acquire_wake_lock(app: &AndroidApp) {
    use jni::objects::{JObject, JValue};

    info!("Acquiring Partial WakeLock...");
    let vm_ptr = app.vm_as_ptr() as *mut jni::sys::JavaVM;
    let vm = unsafe { JavaVM::from_raw(vm_ptr).unwrap() };
    let mut env = vm.attach_current_thread().unwrap();

    let activity_ptr = app.activity_as_ptr() as jni::sys::jobject;
    let context = unsafe { JObject::from_raw(activity_ptr) };

    let power_service_str = env.new_string("power").unwrap();
    let power_manager = env
        .call_method(
            &context,
            "getSystemService",
            "(Ljava/lang/String;)Ljava/lang/Object;",
            &[JValue::Object(&power_service_str)],
        )
        .unwrap()
        .l()
        .unwrap();

    let tag = env.new_string("Mangatan:CpuLock").unwrap();
    let wake_lock = env
        .call_method(
            &power_manager,
            "newWakeLock",
            "(ILjava/lang/String;)Landroid/os/PowerManager$WakeLock;",
            &[JValue::Int(1), JValue::Object(&tag)],
        )
        .unwrap()
        .l()
        .unwrap();

    // 3. Acquire
    let _ = env.call_method(&wake_lock, "acquire", "()V", &[]);

    let _ = env.new_global_ref(&wake_lock).unwrap();

    info!("✅ Partial WakeLock Acquired!");
}
// Add this helper function for getting last update time
fn get_apk_update_time(app: &AndroidApp) -> Option<i64> {
    let vm = unsafe { JavaVM::from_raw(app.vm_as_ptr() as *mut _).ok()? };
    let mut env = vm.attach_current_thread().ok()?; // ← Add `mut` here
    let ctx = unsafe { JObject::from_raw(app.activity_as_ptr() as jni::sys::jobject) };

    let pkg = env
        .call_method(&ctx, "getPackageName", "()Ljava/lang/String;", &[])
        .ok()?
        .l()
        .ok()?;
    let pm = env
        .call_method(
            &ctx,
            "getPackageManager",
            "()Landroid/content/pm/PackageManager;",
            &[],
        )
        .ok()?
        .l()
        .ok()?;
    let info = env
        .call_method(
            &pm,
            "getPackageInfo",
            "(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;",
            &[(&pkg).into(), 0.into()],
        )
        .ok()?
        .l()
        .ok()?;

    env.get_field(&info, "lastUpdateTime", "J").ok()?.j().ok()
}

#[derive(Serialize)]
struct VersionResponse {
    version: String,
    variant: String,
    update_status: String,
}

#[derive(Deserialize)]
struct UpdateRequest {
    url: String,
    filename: String,
}

static LAST_DOWNLOAD_ID: AtomicI64 = AtomicI64::new(-1);

async fn current_version_handler() -> impl IntoResponse {
    let version = env!("CARGO_PKG_VERSION");
    #[cfg(feature = "native_webview")]
    let variant = "native-webview";
    #[cfg(not(feature = "native_webview"))]
    let variant = "browser";

    let update_status = check_update_status();

    Json(VersionResponse {
        version: version.to_string(),
        variant: variant.to_string(),
        update_status,
    })
}

async fn download_update_handler(Json(payload): Json<UpdateRequest>) -> impl IntoResponse {
    match native_download_manager(&payload.url, &payload.filename) {
        Ok(_) => (StatusCode::OK, "Download started".to_string()),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed: {}", e)),
    }
}

async fn install_update_handler() -> impl IntoResponse {
    match native_trigger_install() {
        Ok(_) => (StatusCode::OK, "Install started".to_string()),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed: {}", e)),
    }
}

// --- NATIVE HELPERS ---

fn check_update_status() -> String {
    if let Ok(s) = check_update_status_safe() {
        s
    } else {
        "idle".to_string()
    }
}

fn check_update_status_safe() -> Result<String, Box<dyn std::error::Error>> {
    let id = LAST_DOWNLOAD_ID.load(Ordering::Relaxed);
    if id == -1 {
        return Ok("idle".to_string());
    }

    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }?;
    let mut env = vm.attach_current_thread()?;
    let context_obj = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };

    let dm_str = env.new_string("download")?;
    let dm = env
        .call_method(
            &context_obj,
            "getSystemService",
            "(Ljava/lang/String;)Ljava/lang/Object;",
            &[JValue::Object(&dm_str)],
        )?
        .l()?;

    let query_cls = env.find_class("android/app/DownloadManager$Query")?;
    let query = env.new_object(query_cls, "()V", &[])?;
    let id_array = env.new_long_array(1)?;
    env.set_long_array_region(&id_array, 0, &[id])?;
    env.call_method(
        &query,
        "setFilterById",
        "([J)Landroid/app/DownloadManager$Query;",
        &[JValue::Object(&id_array)],
    )?;

    let cursor = env
        .call_method(
            &dm,
            "query",
            "(Landroid/app/DownloadManager$Query;)Landroid/database/Cursor;",
            &[JValue::Object(&query)],
        )?
        .l()?;

    if env.call_method(&cursor, "moveToFirst", "()Z", &[])?.z()? {
        let status_str = env.new_string("status")?;
        let col_idx = env
            .call_method(
                &cursor,
                "getColumnIndex",
                "(Ljava/lang/String;)I",
                &[JValue::Object(&status_str)],
            )?
            .i()?;
        if col_idx >= 0 {
            let status = env
                .call_method(&cursor, "getInt", "(I)I", &[JValue::Int(col_idx)])?
                .i()?;
            if status == 1 || status == 2 {
                return Ok("downloading".to_string());
            }
            if status == 8 {
                return Ok("ready".to_string());
            }
        }
    }
    Ok("idle".to_string())
}

// --- AUTOMATIC MONITOR TASK ---
// This loops in a background thread to auto-trigger install when done
fn monitor_download_completion(id: i64) {
    info!("👀 Starting download monitor for ID: {}", id);
    loop {
        // Poll every 2 seconds
        thread::sleep(Duration::from_secs(2));

        // Check if ID has changed (new download started) - if so, abort this monitor
        if LAST_DOWNLOAD_ID.load(Ordering::Relaxed) != id {
            info!("🛑 Monitor aborted (New download started)");
            break;
        }

        // Check Status
        if let Ok(status) = check_update_status_safe() {
            if status == "ready" {
                info!("✅ Download {} complete! Triggering install...", id);
                if let Err(e) = native_trigger_install() {
                    error!("❌ Automatic install trigger failed: {}", e);
                }
                break; // Job done
            }
            if status == "idle" {
                // Means it failed or was cancelled
                info!("🛑 Monitor aborted (Download idle/failed)");
                break;
            }
            // If "downloading", just loop again
        } else {
            break; // JNI Error
        }
    }
}

fn native_download_manager(url: &str, filename: &str) -> Result<(), Box<dyn std::error::Error>> {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }?;
    let mut env = vm.attach_current_thread()?;
    let context_obj = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };

    let url_jstr = env.new_string(url)?;
    let fn_jstr = env.new_string(filename)?;

    let uri_cls = env.find_class("android/net/Uri")?;
    let uri = env
        .call_static_method(
            uri_cls,
            "parse",
            "(Ljava/lang/String;)Landroid/net/Uri;",
            &[JValue::Object(&url_jstr)],
        )?
        .l()?;

    let req_cls = env.find_class("android/app/DownloadManager$Request")?;
    let req = env.new_object(req_cls, "(Landroid/net/Uri;)V", &[JValue::Object(&uri)])?;

    let mime = env.new_string("application/vnd.android.package-archive")?;
    env.call_method(
        &req,
        "setMimeType",
        "(Ljava/lang/String;)Landroid/app/DownloadManager$Request;",
        &[JValue::Object(&mime)],
    )?;
    env.call_method(
        &req,
        "setNotificationVisibility",
        "(I)Landroid/app/DownloadManager$Request;",
        &[JValue::Int(1)],
    )?;

    let env_cls = env.find_class("android/os/Environment")?;
    let dir_down = env
        .get_static_field(env_cls, "DIRECTORY_DOWNLOADS", "Ljava/lang/String;")?
        .l()?;
    env.call_method(
        &req,
        "setDestinationInExternalPublicDir",
        "(Ljava/lang/String;Ljava/lang/String;)Landroid/app/DownloadManager$Request;",
        &[JValue::Object(&dir_down), JValue::Object(&fn_jstr)],
    )?;

    let title = env.new_string("Mangatan Update")?;
    env.call_method(
        &req,
        "setTitle",
        "(Ljava/lang/CharSequence;)Landroid/app/DownloadManager$Request;",
        &[JValue::Object(&title)],
    )?;

    let dm_str = env.new_string("download")?;
    let dm = env
        .call_method(
            &context_obj,
            "getSystemService",
            "(Ljava/lang/String;)Ljava/lang/Object;",
            &[JValue::Object(&dm_str)],
        )?
        .l()?;

    let id = env
        .call_method(
            &dm,
            "enqueue",
            "(Landroid/app/DownloadManager$Request;)J",
            &[JValue::Object(&req)],
        )?
        .j()?;

    LAST_DOWNLOAD_ID.store(id, Ordering::Relaxed);

    // --- START BACKGROUND MONITOR ---
    thread::spawn(move || {
        monitor_download_completion(id);
    });

    info!("✅ Download Enqueued ID: {}", id);
    Ok(())
}

fn native_trigger_install() -> Result<(), Box<dyn std::error::Error>> {
    let id = LAST_DOWNLOAD_ID.load(Ordering::Relaxed);
    if id == -1 {
        return Err("No active download".into());
    }

    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }?;
    let mut env = vm.attach_current_thread()?;
    let context_obj = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };

    let dm_str = env.new_string("download")?;
    let dm = env
        .call_method(
            &context_obj,
            "getSystemService",
            "(Ljava/lang/String;)Ljava/lang/Object;",
            &[JValue::Object(&dm_str)],
        )?
        .l()?;

    let uri = env
        .call_method(
            &dm,
            "getUriForDownloadedFile",
            "(J)Landroid/net/Uri;",
            &[JValue::Long(id)],
        )?
        .l()?;
    if uri.is_null() {
        return Err("Download URI is null".into());
    }

    let intent_cls = env.find_class("android/content/Intent")?;
    let action_view = env
        .get_static_field(&intent_cls, "ACTION_VIEW", "Ljava/lang/String;")?
        .l()?;
    let intent = env.new_object(
        &intent_cls,
        "(Ljava/lang/String;)V",
        &[JValue::Object(&action_view)],
    )?;

    let mime = env.new_string("application/vnd.android.package-archive")?;
    env.call_method(
        &intent,
        "setDataAndType",
        "(Landroid/net/Uri;Ljava/lang/String;)Landroid/content/Intent;",
        &[JValue::Object(&uri), JValue::Object(&mime)],
    )?;

    env.call_method(
        &intent,
        "addFlags",
        "(I)Landroid/content/Intent;",
        &[JValue::Int(1 | 268435456)],
    )?;

    env.call_method(
        &context_obj,
        "startActivity",
        "(Landroid/content/Intent;)V",
        &[JValue::Object(&intent)],
    )?;

    info!("✅ Install Intent Started");
    Ok(())
}

fn read_suwayomi_cookies(files_dir: &Path) -> String {
    let cookie_path = files_dir.join("tachidesk_data/settings/cookie_store.xml");

    // Fail silently with empty array if file doesn't exist
    let content = match fs::read_to_string(&cookie_path) {
        Ok(c) => c,
        Err(_) => return "[]".to_string(),
    };

    let mut cookies = Vec::new();

    // Naive XML Parsing for <entry key="domain.index">NAME=VALUE...</entry>
    for line in content.lines() {
        let line = line.trim();
        if !line.starts_with("<entry key=\"") {
            continue;
        }

        // Extract Key
        let key_start = 12;
        let Some(key_end) = line[key_start..].find('"') else {
            continue;
        };
        let key = &line[key_start..key_start + key_end];

        // Skip metadata keys (e.g. "google.com.size")
        if key.ends_with(".size") {
            continue;
        }

        // Extract Value (between "> and </entry>)
        let Some(val_start_marker) = line.find("\">") else {
            continue;
        };
        let val_start = val_start_marker + 2;
        let Some(val_end) = line[val_start..].find("</entry>") else {
            continue;
        };
        let full_value = &line[val_start..val_start + val_end];

        // Parse Cookie String: "NAME=VALUE; expires=...; ..."
        let parts: Vec<&str> = full_value.split(';').collect();
        if parts.is_empty() {
            continue;
        }

        let main_pair = parts[0].trim();
        // Fixed: changed main_part to main_pair
        let Some(eq_idx) = main_pair.find('=') else {
            continue;
        };
        let name = &main_pair[..eq_idx];
        let value = &main_pair[eq_idx + 1..];

        // Infer Domain from Key (remove last .index)
        // Key: "barmanonymity.shop.0" -> "barmanonymity.shop"
        let domain = if let Some(dot_idx) = key.rfind('.') {
            &key[..dot_idx]
        } else {
            key
        };

        cookies.push(json!({
            "name": name,
            "value": value,
            "domain": domain,
            "path": "/",
            "secure": full_value.contains("secure"),
            "httpOnly": full_value.contains("HttpOnly")
        }));
    }

    serde_json::to_string(&cookies).unwrap_or("[]".to_string())
}

fn launch_native_webview_with_cookies(target_url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }?;
    let mut env = vm.attach_current_thread()?;
    let context_obj = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };

    // 1. Get Files Dir to find cookies
    let files_dir_jstr = env
        .call_method(&context_obj, "getFilesDir", "()Ljava/io/File;", &[])?
        .l()?;
    let files_dir_path = env
        .call_method(
            files_dir_jstr,
            "getAbsolutePath",
            "()Ljava/lang/String;",
            &[],
        )?
        .l()?;
    let files_dir_str: String = env.get_string(&files_dir_path.into())?.into();

    // 2. Parse Cookies
    let cookies_json = read_suwayomi_cookies(Path::new(&files_dir_str));

    // 3. Launch Activity
    let pkg_name = "com.mangatan.app";
    let cls_name = "com.mangatan.app.WebviewActivity";

    let intent_cls = env.find_class("android/content/Intent")?;
    let intent = env.new_object(intent_cls, "()V", &[])?;

    let pkg_j = env.new_string(pkg_name)?;
    let cls_j = env.new_string(cls_name)?;

    env.call_method(
        &intent,
        "setClassName",
        "(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;",
        &[(&pkg_j).into(), (&cls_j).into()],
    )?;

    // Extras
    let url_key = env.new_string("TARGET_URL")?;
    let url_val = env.new_string(target_url)?;
    env.call_method(
        &intent,
        "putExtra",
        "(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;",
        &[(&url_key).into(), (&url_val).into()],
    )?;

    let cookie_key = env.new_string("INITIAL_COOKIES")?;
    let cookie_val = env.new_string(&cookies_json)?;
    env.call_method(
        &intent,
        "putExtra",
        "(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;",
        &[(&cookie_key).into(), (&cookie_val).into()],
    )?;

    env.call_method(
        &intent,
        "addFlags",
        "(I)Landroid/content/Intent;",
        &[268435456.into()],
    )?; // FLAG_ACTIVITY_NEW_TASK

    env.call_method(
        &context_obj,
        "startActivity",
        "(Landroid/content/Intent;)V",
        &[(&intent).into()],
    )?;

    Ok(())
}

#[derive(Deserialize)]
struct WebviewLaunchRequest {
    url: String,
}

async fn webview_shim_handler() -> impl IntoResponse {
    info!("⚡ Shim Handler Hit");

    // We use a standard string with \" escapes to ensure the JS string doesn't break if formatted.
    let html = "
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
        <meta charset=\"UTF-8\">
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
        <title>Opening App...</title>
        <style>
            body { background-color: #121212; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
            a { color: #4dabf7; text-decoration: none; border: 1px solid #4dabf7; padding: 10px 20px; border-radius: 5px; margin-top: 20px; display: inline-block;}
            .debug { color: #555; font-size: 0.8rem; margin-top: 20px; word-break: break-all; }
        </style>
    </head>
    <body>
        <p id=\"status\">Opening App...</p>
        <a id=\"link\" href=\"#\" style=\"display:none\">Click Manual Open</a>
        <div id=\"debug\" class=\"debug\"></div>
        
        <script>
            try {
                var target = window.location.hash.substring(1);
                
                if (target) {
                    // Split the long string to prevent 'Unexpected End of Input' if lines wrap
                    var part1 = \"intent://launch?url=\" + encodeURIComponent(target);
                    var part2 = \"#Intent;scheme=mangatan;package=com.mangatan.app;\";
                    var part3 = \"category=android.intent.category.BROWSABLE;end\";
                    
                    var intentUrl = part1 + part2 + part3;
                    
                    document.getElementById('debug').innerText = \"Target: \" + target;
                    
                    // Attempt redirect
                    window.location.replace(intentUrl);
                    
                    // Setup manual link
                    var link = document.getElementById('link');
                    link.href = intentUrl;
                    
                    setTimeout(function() {
                        link.style.display = 'block';
                        document.getElementById('status').innerText = \"Tap below to switch to app:\";
                    }, 1000);
                } else {
                    document.getElementById('status').innerText = \"Error: No URL found in hash.\";
                }
            } catch (e) {
                alert(\"JS Error: \" + e.message);
            }
        </script>
    </body>
    </html>
    ";

    ([(axum::http::header::CONTENT_TYPE, "text/html")], html)
}

fn update_server_conf_local_source(app: &AndroidApp, files_dir: &Path) {
    let pending_marker = files_dir.join(".pending_local_source_config");

    // Safety check: Only proceed if the marker exists (meaning we ran the JNI setup logic)
    if !pending_marker.exists() {
        return;
    }

    info!("🔄 Attempting to patch server.conf with localSourcePath (Fresh Install)...");

    // 1. Get Path via JNI
    let vm_ptr = app.vm_as_ptr() as *mut jni::sys::JavaVM;
    let vm = unsafe { JavaVM::from_raw(vm_ptr).unwrap() };

    let mut env = match vm.attach_current_thread() {
        Ok(env) => env,
        Err(e) => {
            error!("Failed to attach thread for config patch: {:?}", e);
            return;
        }
    };

    let env_cls = match env.find_class("android/os/Environment") {
        Ok(c) => c,
        Err(e) => {
            error!("JNI Error finding Environment: {:?}", e);
            return;
        }
    };

    let dir_obj = match env.call_static_method(
        env_cls,
        "getExternalStorageDirectory",
        "()Ljava/io/File;",
        &[],
    ) {
        Ok(v) => v.l().unwrap(),
        Err(e) => {
            error!("JNI Error getExternalStorageDirectory: {:?}", e);
            return;
        }
    };

    let path_obj = match env.call_method(&dir_obj, "getAbsolutePath", "()Ljava/lang/String;", &[]) {
        Ok(v) => v.l().unwrap(),
        Err(e) => {
            error!("JNI Error getAbsolutePath: {:?}", e);
            return;
        }
    };

    let path_jstr: JString = path_obj.into();
    let path_rust: String = match env.get_string(&path_jstr) {
        Ok(s) => s.into(),
        Err(e) => {
            error!("JNI Error get_string: {:?}", e);
            return;
        }
    };

    // Construct the target directory
    let target_path = format!("{}/Mangatan/local-sources", path_rust);

    if let Err(err) = std::fs::create_dir_all(&target_path) {
        error!("Failed to create local sources dir: {err:?}");
    }

    // 2. Read server.conf
    let conf_path = files_dir.join("tachidesk_data/server.conf");
    if !conf_path.exists() {
        warn!(
            "server.conf not found at {:?}, skipping patch. (Server might not have created it yet?)",
            conf_path
        );
        return;
    }

    let content = match fs::read_to_string(&conf_path) {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to read server.conf: {:?}", e);
            return;
        }
    };

    // 3. Update Line
    let mut new_lines = Vec::new();
    let mut patched = false;

    for line in content.lines() {
        if line.trim().starts_with("server.localSourcePath =") {
            new_lines.push(format!(
                "server.localSourcePath = \"{}\" # Autoconfigured by Mangatan",
                target_path
            ));
            patched = true;
        } else {
            new_lines.push(line.to_string());
        }
    }

    if patched {
        let new_content = new_lines.join("\n");
        if let Err(e) = fs::write(&conf_path, new_content) {
            error!("Failed to write server.conf: {:?}", e);
            return;
        }
        info!(
            "✅ Successfully patched server.conf with localSourcePath: {}",
            target_path
        );

        // Remove marker so we don't do this again
        let _ = fs::remove_file(&pending_marker);
    } else {
        warn!("Could not find 'server.localSourcePath' key in server.conf");
    }
}
