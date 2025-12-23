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
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

use axum::{
    Router,
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
use futures::{SinkExt, StreamExt};
use jni::{
    JavaVM,
    objects::{JObject, JString, JValue},
    signature::{Primitive, ReturnType},
    sys::{JNI_VERSION_1_6, jint, jobject},
};
use lazy_static::lazy_static;
use reqwest::Client;
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
}

impl MangatanApp {
    fn new(_cc: &eframe::CreationContext<'_>, server_ready: Arc<AtomicBool>) -> Self {
        Self { server_ready }
    }
}

impl eframe::App for MangatanApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if !self.server_ready.load(Ordering::Relaxed) {
            ctx.request_repaint();
        }

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.vertical_centered(|ui| {
                ui.add_space(20.0);
                ui.heading(egui::RichText::new("Mangatan").size(32.0).strong());
                ui.add_space(20.0);

                let is_ready = self.server_ready.load(Ordering::Relaxed);

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

    ensure_battery_unrestricted(&app);
    check_and_request_permissions(&app);
    acquire_wifi_lock(&app);
    acquire_wake_lock(&app);
    start_foreground_service(&app);

    let app_bg = app.clone();
    let files_dir = app.internal_data_path().expect("Failed to get data path");
    let files_dir_clone = files_dir.clone();

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
        info!("SDK <= 29: Forcing OpenGL (GLES) backend for compatibility.");
        options.wgpu_options.supported_backends = eframe::wgpu::Backends::GL;
    } else {
        info!("SDK > 29: Using default backend (Vulkan/Primary).");
        options.wgpu_options.supported_backends = eframe::wgpu::Backends::PRIMARY;
    }

    options.event_loop_builder = Some(Box::new(move |builder| {
        builder.with_android_app(app_gui);
    }));

    eframe::run_native(
        "Mangatan",
        options,
        Box::new(move |cc| Ok(Box::new(MangatanApp::new(cc, server_ready_gui)))),
    )
    .unwrap_or_else(|e| {
        error!("GUI Failed to start: {:?}", e);
    });
}

async fn start_web_server(data_dir: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    info!("🚀 Initializing Axum Proxy Server on port 4568...");
    let ocr_router = mangatan_ocr_server::create_router(data_dir.clone());

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

    let proxy_router: Router<AppState> = Router::new()
        .route("/api/{*path}", any(proxy_suwayomi_handler))
        .into();

    let app: Router<AppState> = Router::new()
        .nest_service("/api/ocr", ocr_router)
        .merge(proxy_router)
        .fallback(serve_react_app)
        .layer(cors)
        .into();

    let app_with_state = app.with_state(state);

    let listener = TcpListener::bind("0.0.0.0:4568").await?;
    info!("✅ Web Server listening on 0.0.0.0:4568");
    axum::serve(listener, app_with_state).await?;
    Ok(())
}

async fn serve_react_app(State(state): State<AppState>, uri: Uri) -> impl IntoResponse {
    let path_str = uri.path().trim_start_matches('/');

    if !path_str.is_empty() {
        let file_path = state.webui_dir.join(path_str);

        if file_path.starts_with(&state.webui_dir) && file_path.exists() {
            if let Ok(content) = tokio_fs::read(&file_path).await {
                let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
                return ([(axum::http::header::CONTENT_TYPE, mime.as_ref())], content)
                    .into_response();
            }
        }
    }

    let index_path = state.webui_dir.join("index.html");
    if let Ok(html_string) = tokio_fs::read_to_string(index_path).await {
        let fixed_html = html_string.replace("<head>", "<head><base href=\"/\" />");
        return (
            [(axum::http::header::CONTENT_TYPE, "text/html")],
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
    info!("Background Service: Initializing Assets...");

    let jre_root = files_dir.join("jre");
    if jre_root.exists() {
        fs::remove_dir_all(&jre_root).ok();
    }
    if let Err(e) = install_jre(&app, &files_dir) {
        error!("Failed to extract JRE: {:?}", e);
        return;
    }

    let webui_dir = files_dir.join("webui");
    if webui_dir.exists() {
        fs::remove_dir_all(&webui_dir).ok();
    }
    fs::create_dir_all(&webui_dir).ok();

    info!("Extracting WebUI...");
    if let Err(e) = install_webui(&app, &webui_dir) {
        error!("Failed to extract WebUI: {:?}", e);
    }

    // CHANGE: Create 'bin' directory to satisfy Suwayomi's directory scanner
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
        options_vec.push("-Dsuwayomi.tachidesk.config.server.webUIChannel=BUNDLED".to_string());
        options_vec.push(
            "-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false".to_string(),
        );
        options_vec.push("-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false".to_string());
        options_vec.push(
            "-Dsuwayomi.tachidesk.config.server.rootDir={}"
                .to_string()
                .replace("{}", &tachidesk_data.to_string_lossy()),
        );

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
        let main_class_path = main_class_name.replace(".", "/");
        info!("Found Main: {}", main_class_path);

        let main_class = env.find_class(&main_class_path).unwrap();
        let main_method_id = env
            .get_static_method_id(&main_class, "main", "([Ljava/lang/String;)V")
            .unwrap();
        let empty_str_array = env
            .new_object_array(0, "java/lang/String", JObject::null())
            .unwrap();

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
    let filename = CString::new("jre.tar").unwrap();
    let asset = app
        .asset_manager()
        .open(&filename)
        .ok_or(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "jre.tar missing",
        ))?;
    let mut archive = Archive::new(BufReader::new(asset));
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
            // Fallback to a common package structure or hardcoded value if JNI fails
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
    // This keeps the radio active and high performance even when screen is off.
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
