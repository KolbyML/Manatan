mod io;

use std::{
    env,
    fs::{self},
    path::PathBuf,
    process::Stdio,
    sync::{
        Arc, Mutex,
        mpsc::{Receiver, Sender},
    },
    thread,
    time::Duration,
};

use anyhow::anyhow;
use axum::{
    Router,
    body::{Body, Bytes},
    extract::{
        FromRequestParts, Request, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
};
use clap::Parser;
use directories::{BaseDirs, ProjectDirs};
use eframe::{
    egui::{self},
    icon_data,
};
use futures::{SinkExt, StreamExt, TryStreamExt};
use reqwest::{
    Client, Method,
    header::{
        ACCEPT, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_ORIGIN,
        ACCESS_CONTROL_REQUEST_METHOD, AUTHORIZATION, CONTENT_TYPE, ORIGIN,
    },
};
use rust_embed::RustEmbed;
use serde::Serialize;
use tokio::process::Command;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{
        client::IntoClientRequest,
        protocol::{Message as TungsteniteMessage, frame::coding::CloseCode},
    },
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

#[cfg(feature = "embed-jre")]
use crate::io::extract_zip;
use crate::io::{extract_file, resolve_java};

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

static ICON_BYTES: &[u8] = include_bytes!("../resources/faviconlogo.png");
static JAR_BYTES: &[u8] = include_bytes!("../resources/Suwayomi-Server.jar");

#[cfg(feature = "embed-jre")]
static NATIVES_BYTES: &[u8] = include_bytes!("../resources/natives.zip");

#[derive(RustEmbed)]
#[folder = "resources/mangatan-webui"]
struct FrontendAssets;

#[derive(Serialize)]
struct VersionResponse {
    version: String,
    variant: String,
}

#[derive(Clone, Debug, PartialEq)]
enum UpdateStatus {
    Idle,
    Checking,
    UpdateAvailable(String),
    UpToDate,
    Downloading,
    RestartRequired,
    Error(String),
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Runs the server without the GUI (Fixes Docker/Server deployments)
    #[arg(long, env = "MANGATAN_HEADLESS")]
    headless: bool,

    /// Opens the web interface in the default browser after server start (Requires --headless)
    #[arg(long, requires = "headless")]
    open_page: bool,
}

fn main() -> eframe::Result<()> {
    let args = Cli::parse();

    let rust_log = env::var(EnvFilter::DEFAULT_ENV).unwrap_or_default();
    let env_filter = match rust_log.is_empty() {
        true => EnvFilter::builder().parse_lossy("info"),
        false => EnvFilter::builder().parse_lossy(rust_log),
    };
    tracing_subscriber::fmt().with_env_filter(env_filter).init();

    let proj_dirs =
        ProjectDirs::from("", "", "mangatan").expect("Could not determine home directory");
    let data_dir = proj_dirs.data_dir().to_path_buf();

    let server_data_dir = data_dir.clone();
    let gui_data_dir = data_dir.clone();

    if args.headless {
        info!("👻 Starting in Headless Mode (No GUI)...");

        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");

        rt.block_on(async {
            if args.open_page {
                tokio::spawn(async { open_webpage_when_ready().await });
            }

            let (shutdown_tx, shutdown_rx) = tokio::sync::mpsc::channel::<()>(1);
            tokio::spawn(async move {
                match tokio::signal::ctrl_c().await {
                    Ok(()) => {
                        info!("🛑 Received Ctrl+C, shutting down server...");

                        let _ = shutdown_tx.send(()).await;
                    }

                    Err(err) => {
                        error!("Unable to listen for shutdown signal: {}", err);
                    }
                }
            });

            if let Err(err) = run_server(shutdown_rx, &server_data_dir).await {
                error!("Server crashed: {err}");
            }
        });

        return Ok(());
    }

    let (shutdown_tx, shutdown_rx) = tokio::sync::mpsc::channel::<()>(1);
    let (server_stopped_tx, server_stopped_rx) = std::sync::mpsc::channel::<()>();

    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async {
            tokio::spawn(async { open_webpage_when_ready().await });
            let _guard = ServerGuard {
                tx: server_stopped_tx,
            };

            if let Err(err) = run_server(shutdown_rx, &server_data_dir).await {
                error!("Server crashed: {err}");
            }
        });
    });

    let icon = icon_data::from_png_bytes(ICON_BYTES).expect("The icon data must be valid");
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([320.0, 320.0])
            .with_icon(icon)
            .with_title("Mangatan")
            .with_resizable(false)
            .with_maximize_button(false),
        ..Default::default()
    };

    info!("🎨 Attempting to open GUI window...");
    let result = eframe::run_native(
        "Mangatan",
        options,
        Box::new(|_cc| {
            Ok(Box::new(MyApp::new(
                shutdown_tx,
                server_stopped_rx,
                gui_data_dir,
            )))
        }),
    );

    if let Err(err) = &result {
        error!("❌ CRITICAL GUI ERROR: Failed to start eframe: {err}");
        std::thread::sleep(std::time::Duration::from_secs(5));
    } else {
        info!("👋 GUI exited normally.");
    }

    result
}

struct ServerGuard {
    tx: Sender<()>,
}
impl Drop for ServerGuard {
    fn drop(&mut self) {
        let _ = self.tx.send(());
    }
}

struct MyApp {
    shutdown_tx: tokio::sync::mpsc::Sender<()>,
    server_stopped_rx: Receiver<()>,
    is_shutting_down: bool,
    data_dir: PathBuf,
    update_status: Arc<Mutex<UpdateStatus>>,
}

impl MyApp {
    fn new(
        shutdown_tx: tokio::sync::mpsc::Sender<()>,
        server_stopped_rx: Receiver<()>,
        data_dir: PathBuf,
    ) -> Self {
        // Initialize status
        let update_status = Arc::new(Mutex::new(UpdateStatus::Idle));

        // Optional: Trigger a check immediately on startup
        let status_clone = update_status.clone();
        std::thread::spawn(move || {
            if !is_flatpak() {
                check_for_updates(status_clone);
            }
        });

        Self {
            shutdown_tx,
            server_stopped_rx,
            is_shutting_down: false,
            data_dir,
            update_status,
        }
    }

    fn trigger_update(&self) {
        let status_clone = self.update_status.clone();

        *status_clone.lock().expect("lock shouldn't panic") = UpdateStatus::Downloading;

        std::thread::spawn(move || match perform_update() {
            Ok(_) => {
                *status_clone.lock().expect("lock shouldn't panic") = UpdateStatus::RestartRequired
            }
            Err(e) => {
                *status_clone.lock().expect("lock shouldn't panic") =
                    UpdateStatus::Error(e.to_string())
            }
        });
    }
}

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Handle window close requests
        if ctx.input(|i| i.viewport().close_requested()) {
            if !self.is_shutting_down {
                self.is_shutting_down = true;
                tracing::info!("❌ Close requested. Signaling server to stop...");
                let _ = self.shutdown_tx.try_send(());
            }
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        }

        if self.is_shutting_down {
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(80.0);
                    ui.spinner();
                    ui.add_space(10.0);
                    ui.heading("Stopping Servers...");
                    ui.label("Cleaning up child processes...");
                });
            });

            if self.server_stopped_rx.try_recv().is_ok() {
                std::process::exit(0);
            }
            ctx.request_repaint();
            return;
        }

        // --- NORMAL UI ---

        // 1. Version Footer (Floating)
        egui::Area::new("version_watermark".into())
            .anchor(egui::Align2::LEFT_BOTTOM, [8.0, -8.0])
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                ui.weak(format!("v{APP_VERSION}"));
            });

        egui::CentralPanel::default().show(ctx, |ui| {
            // --- TOP HEADER: Title & Updates ---
            ui.horizontal(|ui| {
                ui.heading("Mangatan");
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if is_flatpak() {
                        ui.weak(format!("Flatpak: v{APP_VERSION}"));
                    } else {
                        let status = self
                            .update_status
                            .lock()
                            .expect("lock shouldn't panic")
                            .clone();
                        match status {
                            UpdateStatus::Idle | UpdateStatus::UpToDate => {
                                if ui.small_button("🔄 Check Updates").clicked() {
                                    let status_clone = self.update_status.clone();
                                    std::thread::spawn(move || check_for_updates(status_clone));
                                }
                            }
                            UpdateStatus::Checking => {
                                ui.spinner();
                            }
                            _ => {} // Handle active updates in the main body
                        }
                    }
                });
            });

            ui.separator();
            ui.add_space(10.0);

            // --- UPDATE NOTIFICATIONS AREA ---
            let status = self
                .update_status
                .lock()
                .expect("lock shouldn't panic")
                .clone();
            match status {
                UpdateStatus::UpdateAvailable(ver) => {
                    ui.group(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.colored_label(
                                egui::Color32::LIGHT_BLUE,
                                format!("✨ Update {ver} Available"),
                            );
                            ui.add_space(5.0);
                            if ui.button("⬇ Download & Install").clicked() {
                                self.trigger_update();
                            }
                        });
                    });
                    ui.add_space(10.0);
                }
                UpdateStatus::Downloading => {
                    ui.group(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.spinner();
                            ui.label("Downloading update...");
                        });
                    });
                    ui.add_space(10.0);
                }
                UpdateStatus::RestartRequired => {
                    ui.group(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.colored_label(egui::Color32::GREEN, "✔ Update Ready!");
                            ui.add_space(5.0);
                            if ui.button("🚀 Restart App").clicked() {
                                if let Ok(exe_path) = std::env::current_exe() {
                                    let mut exe_str = exe_path.to_string_lossy().to_string();
                                    if cfg!(target_os = "linux") && exe_str.ends_with(" (deleted)")
                                    {
                                        exe_str = exe_str.replace(" (deleted)", "");
                                    }
                                    let _ = std::process::Command::new(exe_str).spawn();
                                }
                                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                            }
                        });
                    });
                    ui.add_space(10.0);
                }
                UpdateStatus::Error(e) => {
                    ui.colored_label(egui::Color32::RED, "Update Failed");
                    ui.small(e.chars().take(40).collect::<String>());
                    if ui.button("Retry").clicked() {
                        *self.update_status.lock().expect("lock shouldn't panic") =
                            UpdateStatus::Idle;
                    }
                    ui.add_space(10.0);
                }
                _ => {}
            }

            // --- PRIMARY ACTION (THE "HERO" BUTTON) ---
            ui.vertical_centered(|ui| {
                ui.add_space(5.0);
                let btn_size = egui::vec2(ui.available_width() * 0.9, 45.0);
                let btn =
                    egui::Button::new(egui::RichText::new("🚀 OPEN WEB UI").size(18.0).strong())
                        .min_size(btn_size);

                if ui.add(btn).clicked() {
                    let _ = open::that("http://localhost:4568");
                }
            });

            ui.add_space(15.0);

            // --- SECONDARY ACTIONS (Community) ---
            ui.vertical_centered(|ui| {
                if ui.button("💬 Join Discord Community").clicked() {
                    let _ = open::that("https://discord.gg/tDAtpPN8KK");
                }
            });

            ui.add_space(15.0);
            ui.separator();

            // --- TERTIARY ACTIONS (Data Management) ---
            ui.add_space(5.0);
            ui.label("Data Management:");

            // Simplified Grid Layout (Less nesting, safer to copy)
            ui.horizontal(|ui| {
                let width = (ui.available_width() - 10.0) / 2.0;

                // Button 1: Mangatan Data
                if ui
                    .add_sized([width, 30.0], egui::Button::new("📂 Mangatan Data"))
                    .clicked()
                {
                    if !self.data_dir.exists() {
                        let _ = std::fs::create_dir_all(&self.data_dir);
                    }
                    let _ = open::that(&self.data_dir);
                }

                // Button 2: Suwayomi Data
                if ui
                    .add_sized([width, 30.0], egui::Button::new("📂 Suwayomi Data"))
                    .clicked()
                    && let Some(base_dirs) = BaseDirs::new()
                {
                    let dir = base_dirs.data_local_dir().join("Tachidesk");
                    if !dir.exists() {
                        let _ = std::fs::create_dir_all(&dir);
                    }
                    let _ = open::that(&dir);
                }
            });
        });
    }
}

async fn run_server(
    mut shutdown_signal: tokio::sync::mpsc::Receiver<()>,
    data_dir: &PathBuf,
) -> Result<(), Box<anyhow::Error>> {
    info!("🚀 Initializing Mangatan Launcher...");
    info!("📂 Data Directory: {}", data_dir.display());

    if !data_dir.exists() {
        fs::create_dir_all(data_dir).map_err(|err| anyhow!("Failed to create data dir {err:?}"))?;
    }
    let bin_dir = data_dir.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|err| anyhow!("Failed to create bin dir {err:?}"))?;
    }

    info!("📦 Extracting assets...");
    let jar_name = "Suwayomi-Server.jar";
    let _ = extract_file(&bin_dir, jar_name, JAR_BYTES)
        .map_err(|err| anyhow!("Failed to extract {jar_name} {err:?}"))?;
    let jar_rel_path = PathBuf::from("bin").join(jar_name);

    #[cfg(feature = "embed-jre")]
    {
        let natives_dir = data_dir.join("natives");
        if !natives_dir.exists() {
            info!("📦 Extracting Native Libraries (JogAmp)...");
            fs::create_dir_all(&natives_dir)
                .map_err(|e| anyhow!("Failed to create natives dir: {e}"))?;

            extract_zip(NATIVES_BYTES, &natives_dir)
                .map_err(|e| anyhow!("Failed to extract natives: {e}"))?;
        }
    }

    info!("🔍 Resolving Java...");
    let java_exec =
        resolve_java(data_dir).map_err(|err| anyhow!("Failed to resolve java install {err:?}"))?;
    let java_home = java_exec
        .parent()
        .and_then(|p| p.parent())
        .unwrap_or(data_dir);

    info!("☕ Spawning Suwayomi...");
    let mut suwayomi_proc = Command::new(&java_exec)
        .current_dir(data_dir)
        .env("JAVA_HOME", java_home)
        .arg("-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.webUIChannel=BUNDLED")
        .arg("-XX:+ExitOnOutOfMemoryError")
        .arg("--enable-native-access=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/sun.awt=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/javax.swing=ALL-UNNAMED")
        .arg("-jar")
        .arg(&jar_rel_path)
        .kill_on_drop(true)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|err| anyhow!("Failed to launch suwayomi {err:?}"))?;

    info!("🌍 Starting Web Interface at http://localhost:4568");

    let ocr_router = mangatan_ocr_server::create_router(data_dir.clone());
    let yomitan_router = mangatan_yomitan_server::create_router(data_dir.clone(), true);
    let system_router = Router::new().route("/version", any(current_version_handler));

    let client = Client::new();
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
            AUTHORIZATION,
            CONTENT_TYPE,
            ACCEPT,
            ORIGIN,
            ACCESS_CONTROL_ALLOW_ORIGIN,
            ACCESS_CONTROL_ALLOW_HEADERS,
            ACCESS_CONTROL_REQUEST_METHOD,
        ])
        .allow_credentials(true);

    let proxy_router = Router::new()
        .route("/api/{*path}", any(proxy_suwayomi_handler))
        .with_state(client);

    let app = Router::new()
        .nest("/api/ocr", ocr_router)
        .nest("/api/yomitan", yomitan_router)
        .nest("/api/system", system_router)
        .merge(proxy_router)
        .fallback(serve_react_app)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:4568")
        .await
        .map_err(|err| anyhow!("Failed create main server socket: {err:?}"))?;

    let server_future = axum::serve(listener, app).with_graceful_shutdown(async move {
        let _ = shutdown_signal.recv().await;
        info!("🛑 Shutdown signal received.");
    });

    info!("✅ Unified Server Running.");

    tokio::select! {
        _ = suwayomi_proc.wait() => { error!("❌ Suwayomi exited unexpectedly"); }
        _ = server_future => { info!("✅ Web server shutdown complete."); }
    }

    info!("🛑 terminating child processes...");

    if let Err(err) = suwayomi_proc.kill().await {
        error!("Error killing Suwayomi: {err}");
    }
    let _ = suwayomi_proc.wait().await;
    info!("   Suwayomi terminated.");

    Ok(())
}

async fn proxy_suwayomi_handler(State(client): State<Client>, req: Request) -> Response {
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
                // FIX 2: Tell Axum to accept these protocols in the handshake
                return ws
                    .protocols(protocols)
                    .on_upgrade(move |socket| handle_socket(socket, headers, backend_url))
                    .into_response();
            }
            Err(err) => {
                return err.into_response();
            }
        }
    }

    let req = Request::from_parts(parts, body);
    proxy_request(client, req, "http://127.0.0.1:4567", "").await
}

pub async fn ws_proxy_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    uri: Uri,
) -> impl IntoResponse {
    let path_query = uri
        .path_and_query()
        .map(|v| v.as_str())
        .unwrap_or(uri.path());
    let backend_url = format!("ws://127.0.0.1:4567{path_query}");

    // FIX 3: Apply the same protocol logic to the direct handler if used
    let protocols: Vec<String> = headers
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();

    ws.protocols(protocols)
        .on_upgrade(move |socket| handle_socket(socket, headers, backend_url))
}

async fn handle_socket(client_socket: WebSocket, headers: HeaderMap, backend_url: String) {
    let mut request = match backend_url.clone().into_client_request() {
        Ok(req) => req,
        Err(e) => {
            error!("Invalid backend URL {}: {}", backend_url, e);
            return;
        }
    };

    let headers_to_forward = [
        "cookie",
        "authorization",
        "user-agent",
        "sec-websocket-protocol",
        "origin",
    ];
    for &name in &headers_to_forward {
        if let Some(value) = headers.get(name) {
            request.headers_mut().insert(name, value.clone());
        }
    }

    let (backend_socket, _) = match connect_async(request).await {
        Ok(conn) => conn,
        Err(e) => {
            error!(
                "Failed to connect to backend WebSocket at {}: {}",
                backend_url, e
            );
            return;
        }
    };

    let (mut client_sender, mut client_receiver) = client_socket.split();
    let (mut backend_sender, mut backend_receiver) = backend_socket.split();

    loop {
        tokio::select! {
            msg = client_receiver.next() => {
                match msg {
                    Some(Ok(msg)) => {
                        if let Some(t_msg) = axum_to_tungstenite(msg) && backend_sender.send(t_msg).await.is_err() { break; }
                    }
                    Some(Err(e)) => {
                        // FIX 4: Filter out noisy "ConnectionReset" logs
                        if is_connection_reset(&e) {
                            warn!("Client disconnected (reset): {}", e);
                        } else {
                            warn!("Client WebSocket error: {}", e);
                        }
                        break;
                    }
                    None => break,
                }
            }
            msg = backend_receiver.next() => {
                match msg {
                    Some(Ok(msg)) => {
                        let a_msg = tungstenite_to_axum(msg);
                        if client_sender.send(a_msg).await.is_err() { break; }
                    }
                    Some(Err(e)) => {
                         warn!("Backend WebSocket error: {}", e);
                         break;
                    }
                    None => break,
                }
            }
        }
    }
}

// Helper to identify benign reset errors
fn is_connection_reset(err: &axum::Error) -> bool {
    let s = err.to_string();
    s.contains("Connection reset")
        || s.contains("broken pipe")
        || s.contains("without closing handshake")
}

// ... (Converters and other functions remain the same) ...
fn axum_to_tungstenite(msg: Message) -> Option<TungsteniteMessage> {
    match msg {
        Message::Text(t) => Some(TungsteniteMessage::Text(t.as_str().into())),
        Message::Binary(b) => Some(TungsteniteMessage::Binary(b)),
        Message::Ping(p) => Some(TungsteniteMessage::Ping(p)),
        Message::Pong(p) => Some(TungsteniteMessage::Pong(p)),
        Message::Close(c) => {
            let frame = c.map(|cf| tokio_tungstenite::tungstenite::protocol::CloseFrame {
                code: CloseCode::from(cf.code),
                reason: cf.reason.as_str().into(),
            });
            Some(TungsteniteMessage::Close(frame))
        }
    }
}

fn tungstenite_to_axum(msg: TungsteniteMessage) -> Message {
    match msg {
        TungsteniteMessage::Text(t) => Message::Text(t.as_str().into()),
        TungsteniteMessage::Binary(b) => Message::Binary(b),
        TungsteniteMessage::Ping(p) => Message::Ping(p),
        TungsteniteMessage::Pong(p) => Message::Pong(p),
        TungsteniteMessage::Close(c) => {
            let frame = c.map(|cf| axum::extract::ws::CloseFrame {
                code: u16::from(cf.code),
                reason: cf.reason.as_str().into(),
            });
            Message::Close(frame)
        }
        TungsteniteMessage::Frame(_) => Message::Binary(Bytes::new()),
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
            let status = resp.status();
            let mut response_builder = Response::builder().status(status);
            for (key, value) in resp.headers() {
                response_builder = response_builder.header(key, value);
            }
            let stream = resp.bytes_stream().map_err(std::io::Error::other);
            response_builder
                .body(Body::from_stream(stream))
                .expect("Failed to build proxied response")
        }
        Err(err) => {
            info!("Proxy Error to {target_url}: {err}");
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::empty())
                .expect("Failed to build error response")
        }
    }
}

async fn serve_react_app(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    if !path.is_empty()
        && let Some(content) = FrontendAssets::get(path)
    {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return (
            [(axum::http::header::CONTENT_TYPE, mime.as_ref())],
            content.data,
        )
            .into_response();
    }

    if let Some(index) = FrontendAssets::get("index.html")
        && let Ok(html_string) = std::str::from_utf8(index.data.as_ref())
    {
        let fixed_html = html_string.replace("<head>", "<head><base href=\"/\" />");

        return (
            [(axum::http::header::CONTENT_TYPE, "text/html")],
            fixed_html,
        )
            .into_response();
    }

    (StatusCode::NOT_FOUND, "404 - Index.html missing").into_response()
}

fn get_asset_target_string() -> &'static str {
    #[cfg(target_os = "windows")]
    return "Windows-x64";

    #[cfg(target_os = "macos")]
    {
        #[cfg(target_arch = "aarch64")]
        return "macOS-Silicon";
        #[cfg(target_arch = "x86_64")]
        return "macOS-Intel";
    }

    #[cfg(target_os = "linux")]
    {
        #[cfg(target_arch = "aarch64")]
        return "Linux-arm64.tar";

        #[cfg(target_arch = "x86_64")]
        return "Linux-amd64.tar";
    }
}

fn check_for_updates(status: Arc<Mutex<UpdateStatus>>) {
    *status.lock().expect("lock shouldn't panic") = UpdateStatus::Checking;

    // We use the same configuration for checking as we do for updating
    // This ensures we only "find" releases that actually match our custom asset naming
    let target_str = get_asset_target_string();

    let updater_result = self_update::backends::github::Update::configure()
        .repo_owner("KolbyML")
        .repo_name("Mangatan")
        .bin_name("mangatan") // This must match the binary name inside the zip/tar
        .target(target_str) // CRITICAL: Forces it to look for "Windows-x64" etc.
        .current_version(APP_VERSION)
        .build();

    match updater_result {
        Ok(updater) => {
            match updater.get_latest_release() {
                Ok(release) => {
                    // Check if remote version > local version
                    let is_newer =
                        self_update::version::bump_is_greater(APP_VERSION, &release.version)
                            .unwrap_or(false);

                    if is_newer {
                        *status.lock().expect("lock shouldn't panic") =
                            UpdateStatus::UpdateAvailable(release.version);
                    } else {
                        *status.lock().expect("lock shouldn't panic") = UpdateStatus::UpToDate;
                    }
                }
                Err(e) => {
                    *status.lock().expect("lock shouldn't panic") =
                        UpdateStatus::Error(e.to_string())
                }
            }
        }
        Err(e) => {
            *status.lock().expect("lock shouldn't panic") = UpdateStatus::Error(e.to_string())
        }
    }
}

fn perform_update() -> Result<(), Box<dyn std::error::Error>> {
    let target_str = get_asset_target_string();

    self_update::backends::github::Update::configure()
        .repo_owner("KolbyML")
        .repo_name("Mangatan")
        .bin_name("mangatan")
        .target(target_str)
        .show_download_progress(true)
        .current_version(APP_VERSION)
        .no_confirm(true)
        .build()?
        .update()?;

    Ok(())
}

async fn open_webpage_when_ready() {
    let client = Client::new();
    let query_payload = r#"{"query": "query AllCategories { categories { nodes { mangas { nodes { title } } } } }"}"#;

    info!("⏳ Polling GraphQL endpoint for readiness (timeout 10s)...");

    // Define the polling task
    let polling_task = async {
        loop {
            let request = client
                .post("http://127.0.0.1:4568/api/graphql")
                .header("Content-Type", "application/json")
                .body(query_payload);

            match request.send().await {
                Ok(resp)
                    if resp.status().is_success() || resp.status() == StatusCode::UNAUTHORIZED =>
                {
                    info!("✅ Server is responsive! Opening browser...");
                    if let Err(e) = open::that("http://localhost:4568") {
                        error!("❌ Failed to open browser: {}", e);
                    }
                    return;
                }
                err => {
                    warn!("Failed to poll graphql to open webpage: {err:?}");
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            }
        }
    };

    if tokio::time::timeout(Duration::from_secs(10), polling_task)
        .await
        .is_err()
    {
        error!("❌ Timed out waiting for server readiness (10s). Browser open cancelled.");
    }
}

async fn current_version_handler() -> impl IntoResponse {
    axum::Json(VersionResponse {
        version: APP_VERSION.to_string(),
        variant: "desktop".to_string(), // Frontend will see 'desktop' and HIDE the button
    })
}

fn is_flatpak() -> bool {
    std::env::var("FLATPAK_ID").is_ok()
}
