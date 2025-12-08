use std::{
    fs::{self, File},
    io::{self, Cursor, Write},
    path::{Path, PathBuf},
    process::Stdio,
    sync::mpsc::{self, Receiver, Sender},
    thread,
};

use anyhow::anyhow;
use axum::{
    Router,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
};
use directories::ProjectDirs;
use eframe::{
    egui::{self},
    icon_data,
};
use futures::TryStreamExt;
use reqwest::Client;
use rust_embed::RustEmbed;
use tokio::process::Command;
use tower_http::cors::{Any, CorsLayer};

const ICON_BYTES: &[u8] = include_bytes!("../resources/faviconlogo.png");
const JAR_BYTES: &[u8] = include_bytes!("../resources/Suwayomi-Server.jar");

#[cfg(feature = "embed-jre")]
const JRE_BYTES: &[u8] = include_bytes!("../resources/jre_bundle.zip");

#[cfg(target_os = "windows")]
const OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-win.exe");

#[cfg(target_os = "linux")]
const OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-linux");

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-macos-arm64");

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
const OCR_BYTES: &[u8] = include_bytes!("../resources/ocr-server-macos-x64");

#[derive(RustEmbed)]
#[folder = "resources/suwayomi-webui"]
struct FrontendAssets;

fn main() -> eframe::Result<()> {
    let (shutdown_tx, mut shutdown_rx) = tokio::sync::mpsc::channel::<()>(1);

    let (server_stopped_tx, server_stopped_rx) = mpsc::channel::<()>();

    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async {
            let _guard = ServerGuard {
                tx: server_stopped_tx,
            };

            if let Err(err) = run_server(&mut shutdown_rx).await {
                eprintln!("Server crashed: {err}");
            }
        });
    });

    let icon = icon_data::from_png_bytes(ICON_BYTES).expect("The icon data must be valid");
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([300.0, 150.0])
            .with_icon(icon)
            .with_title("Mangatan")
            .with_resizable(false)
            .with_maximize_button(false),
        ..Default::default()
    };

    eframe::run_native(
        "Mangatan",
        options,
        Box::new(|_cc| Ok(Box::new(MyApp::new(shutdown_tx, server_stopped_rx)))),
    )
}

struct ServerGuard {
    tx: Sender<()>,
}
impl Drop for ServerGuard {
    fn drop(&mut self) {
        let _ = self.tx.send(()); // Tell GUI we are done
    }
}

struct MyApp {
    shutdown_tx: tokio::sync::mpsc::Sender<()>,
    server_stopped_rx: Receiver<()>,
    is_shutting_down: bool,
}

impl MyApp {
    fn new(shutdown_tx: tokio::sync::mpsc::Sender<()>, server_stopped_rx: Receiver<()>) -> Self {
        Self {
            shutdown_tx,
            server_stopped_rx,
            is_shutting_down: false,
        }
    }
}

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if ctx.input(|i| i.viewport().close_requested()) {
            if !self.is_shutting_down {
                self.is_shutting_down = true;
                println!("❌ Close requested. Signaling server to stop...");

                let _ = self.shutdown_tx.try_send(());
            }
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        }

        if self.is_shutting_down {
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(50.0);
                    ui.heading("Stopping Servers...");
                    ui.add_space(10.0);
                    ui.spinner();
                    ui.label("Cleaning up child processes. Please wait.");
                });
            });

            if self.server_stopped_rx.try_recv().is_ok() {
                println!("✅ Server cleanup complete. Exiting.");
                std::process::exit(0);
            }

            ctx.request_repaint();
        } else {
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(20.0);
                    ui.heading("Mangatan Launcher");
                    ui.add_space(20.0);
                    if ui.button("Open Web UI").clicked() {
                        let _ = open::that("http://localhost:4568");
                    }
                });
            });
        }
    }
}

async fn run_server(
    shutdown_signal: &mut tokio::sync::mpsc::Receiver<()>,
) -> Result<(), Box<anyhow::Error>> {
    println!("🚀 Initializing Mangatan Launcher...");

    let proj_dirs = ProjectDirs::from("", "", "mangatan")
        .ok_or(anyhow!("Could not determine home directory"))?;
    let data_dir = proj_dirs.data_dir();

    println!("📂 Data Directory: {}", data_dir.display());

    if data_dir.exists() {
        if let Err(err) = fs::remove_dir_all(data_dir) {
            eprintln!("⚠️ Warning: Could not fully clear data directory: {err}");
            eprintln!(
                "   (This usually means an old process is still running. Check Task Manager.)"
            );
        }
    }

    if !data_dir.exists() {
        fs::create_dir_all(data_dir).map_err(|err| anyhow!("Failed to create data dir {err:?}"))?;
    }
    let bin_dir = data_dir.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|err| anyhow!("Failed to create bin dir {err:?}"))?;
    }

    println!("📦 Extracting assets...");
    let jar_name = "Suwayomi-Server.jar";
    let jar_path = extract_file(&bin_dir, jar_name, JAR_BYTES)
        .map_err(|err| anyhow!("Failed to extract {jar_name} {err:?}"))?;

    let ocr_bin_name = if cfg!(target_os = "windows") {
        "ocr-server.exe"
    } else {
        "ocr-server"
    };
    let ocr_path = extract_executable(&bin_dir, ocr_bin_name, OCR_BYTES)
        .map_err(|err| anyhow!("Failed to extract ocr server {err:?}"))?;

    let java_exec =
        resolve_java(data_dir).map_err(|err| anyhow!("Failed to resolve java install {err:?}"))?;

    println!("👁️ Spawning OCR...");
    let mut ocr_proc = Command::new(&ocr_path)
        .arg("--port")
        .arg("3033")
        .kill_on_drop(true)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|err| anyhow!("Failed to launch ocr server {err:?}"))?;

    println!("☕ Spawning Suwayomi...");
    let mut suwayomi_proc = Command::new(&java_exec)
        .arg("-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false")
        .arg("-Dsuwayomi.tachidesk.config.server.webUIChannel=BUNDLED")
        .arg("-XX:+ExitOnOutOfMemoryError")
        .arg("--enable-native-access=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/sun.awt=ALL-UNNAMED")
        .arg("--add-opens=java.desktop/javax.swing=ALL-UNNAMED")
        .arg("-jar")
        .arg(&jar_path)
        .kill_on_drop(true)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|err| anyhow!("Failed to launch suwayomi {err:?}"))?;

    println!("🌍 Starting Web Interface at http://localhost:4568");
    let client = Client::new();
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/ocr", any(proxy_ocr_handler))
        .route("/api/ocr/", any(proxy_ocr_handler))
        .route("/api/ocr/{*path}", any(proxy_ocr_handler))
        .route("/api/{*path}", any(proxy_suwayomi_handler))
        .fallback(serve_react_app)
        .layer(cors)
        .with_state(client);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:4568")
        .await
        .map_err(|err| anyhow!("Failed create proxies socket: {err:?}"))?;

    let server_future = axum::serve(listener, app).into_future();

    println!("✅ Servers Running. Waiting for shutdown signal...");

    tokio::select! {
        _ = suwayomi_proc.wait() => { eprintln!("❌ Suwayomi exited unexpectedly"); }
        _ = ocr_proc.wait() => { eprintln!("❌ OCR exited unexpectedly"); }
        _ = server_future => { eprintln!("❌ Web server exited unexpectedly"); }
        _ = shutdown_signal.recv() => {
            println!("🛑 Shutdown signal received via GUI.");
        }
    }

    println!("🛑 terminating child processes...");

    if let Err(err) = suwayomi_proc.kill().await {
        eprintln!("Error killing Suwayomi: {err}");
    }
    let _ = suwayomi_proc.wait().await;
    println!("   Suwayomi terminated.");

    if let Err(err) = ocr_proc.kill().await {
        eprintln!("Error killing OCR: {err}");
    }
    let _ = ocr_proc.wait().await;
    println!("   OCR terminated.");

    Ok(())
}

async fn proxy_ocr_handler(State(client): State<Client>, req: Request) -> impl IntoResponse {
    proxy_request(client, req, "http://127.0.0.1:3033", "/api/ocr").await
}

async fn proxy_suwayomi_handler(State(client): State<Client>, req: Request) -> impl IntoResponse {
    proxy_request(client, req, "http://127.0.0.1:4567", "").await
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
            let stream = resp.bytes_stream().map_err(io::Error::other);
            response_builder
                .body(Body::from_stream(stream))
                .expect("Failed to build proxied response")
        }
        Err(err) => {
            println!("Proxy Error to {target_url}: {err}");
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

fn extract_file(dir: &Path, name: &str, bytes: &[u8]) -> std::io::Result<PathBuf> {
    let path = dir.join(name);
    if path.exists() {
        fs::remove_file(&path)?;
    }
    let mut file = File::create(&path)?;
    file.write_all(bytes)?;
    Ok(path)
}

fn extract_executable(dir: &Path, name: &str, bytes: &[u8]) -> std::io::Result<PathBuf> {
    let path = extract_file(dir, name, bytes)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&path)?.permissions();
        perms.set_mode(0o755); // rwxr-xr-x
        fs::set_permissions(&path, perms)?;
    }

    Ok(path)
}

#[allow(unused_variables)]
fn resolve_java(data_dir: &Path) -> std::io::Result<PathBuf> {
    #[cfg(feature = "embed-jre")]
    {
        let jre_dir = data_dir.join("jre");
        let bin_name = if cfg!(target_os = "windows") {
            "java.exe"
        } else {
            "java"
        };

        let java_path = jre_dir.join("bin").join(bin_name);

        if !java_path.exists() {
            println!("📦 Extracting Embedded JRE...");
            if jre_dir.exists() {
                let _ = fs::remove_dir_all(&jre_dir);
            }

            extract_zip(JRE_BYTES, &jre_dir)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if java_path.exists() {
                    let mut perms = fs::metadata(&java_path)?.permissions();
                    perms.set_mode(0o755);
                    fs::set_permissions(&java_path, perms)?;
                }
            }
        }
        return Ok(java_path);
    }

    #[cfg(not(feature = "embed-jre"))]
    {
        println!("🛠️ Development Mode: Using System Java");
        let bin_name = if cfg!(target_os = "windows") {
            "java.exe"
        } else {
            "java"
        };

        if let Ok(home) = std::env::var("JAVA_HOME") {
            let path = PathBuf::from(home).join("bin").join(bin_name);
            if path.exists() {
                return Ok(path);
            }
        }

        Ok(PathBuf::from(bin_name))
    }
}

pub fn extract_zip(zip_bytes: &[u8], target_dir: &Path) -> std::io::Result<()> {
    let reader = Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(io::Error::other)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(io::Error::other)?;

        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent()
                && !p.exists()
            {
                fs::create_dir_all(p)?;
            }
            let mut outfile = File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }
    }
    Ok(())
}
