use std::{
    fs::{self, File},
    io::{self, Cursor, Write},
    path::{Path, PathBuf},
    process::Stdio,
};

use axum::{
    Router,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
};
use directories::ProjectDirs;
use futures::TryStreamExt;
use reqwest::Client;
use rust_embed::RustEmbed;
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tokio::process::Command;
use tray_icon::{
    TrayIconBuilder,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
};

const ICON_BYTES: &[u8] = include_bytes!("../resources/faviconlogo.png");
const JAR_BYTES: &[u8] = include_bytes!("../resources/suwayomi-server.jar");

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

fn main() {
    let event_loop = EventLoopBuilder::new().build();

    let icon = load_icon(ICON_BYTES);

    let tray_menu = Menu::new();

    let open_browser_item = MenuItem::new("Open Web UI", true, None);
    let quit_item = MenuItem::new("Quit", true, None);

    let _ = tray_menu.append(&open_browser_item);
    let _ = tray_menu.append(&PredefinedMenuItem::separator());
    let _ = tray_menu.append(&quit_item);

    let _tray_icon = TrayIconBuilder::new()
        .with_menu(Box::new(tray_menu))
        .with_tooltip("Mangatan Server")
        .with_icon(icon)
        .build()
        .expect("Failed to build tray icon");

    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async {
            if let Err(err) = run_server().await {
                eprintln!("Server crashed: {err}");
            }
        });
    });

    let open_id = open_browser_item.id().clone();
    let quit_id = quit_item.id().clone();

    let menu_channel = MenuEvent::receiver();

    event_loop.run(move |_event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        if let Ok(event) = menu_channel.try_recv() {
            if event.id == open_id {
                println!("Opening Browser...");
                let _ = open::that("http://localhost:8080");
            } else if event.id == quit_id {
                println!("Shutting down...");
                *control_flow = ControlFlow::Exit;
                std::process::exit(0);
            }
        }
    });
}

async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Initializing Mangatan Launcher...");

    let proj_dirs = ProjectDirs::from("com", "mangatan", "server")
        .ok_or("Could not determine home directory")?;
    let data_dir = proj_dirs.data_dir();

    if !data_dir.exists() {
        fs::create_dir_all(data_dir)?;
    }
    println!("📂 Data Directory: {}", data_dir.display());

    println!("📦 Extracting assets...");
    let jar_path = extract_file(data_dir, "suwayomi-server.jar", JAR_BYTES)?;

    let ocr_bin_name = if cfg!(target_os = "windows") {
        "ocr-server.exe"
    } else {
        "ocr-server"
    };
    let ocr_path = extract_executable(data_dir, ocr_bin_name, OCR_BYTES)?;

    let java_exec = resolve_java(data_dir)?;

    println!("☕ Spawning Suwayomi (Port 4567)...");
    let mut suwayomi_proc = Command::new(&java_exec)
        .arg("-Dsuwayomi.tachidesk.config.server.webUIEnabled=false")
        .arg("-jar")
        .arg(&jar_path)
        .kill_on_drop(true)
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn()?;

    println!("👁️ Spawning OCR (Port 3033)...");
    let mut ocr_proc = Command::new(&ocr_path)
        .arg("--port")
        .arg("3033")
        .kill_on_drop(true)
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn()?;

    println!("🌍 Starting Web Interface at http://localhost:8080");
    let client = Client::new();

    let app = Router::new()
        .route("/api/ocr", any(proxy_ocr_handler))
        .route("/api/ocr/", any(proxy_ocr_handler))
        .route("/api/ocr/{*path}", any(proxy_ocr_handler))
        .route("/api/{*path}", any(proxy_suwayomi_handler))
        .fallback(serve_react_app)
        .with_state(client);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;

    let server_future = axum::serve(listener, app).into_future();

    tokio::select! {
        status = suwayomi_proc.wait() => {
            eprintln!("❌ CRITICAL: Suwayomi Server crashed or exited!");
            if let Ok(s) = status {
                eprintln!("   Exit Code: {:?}", s.code());
            }
        }
        status = ocr_proc.wait() => {
            eprintln!("❌ CRITICAL: OCR Server crashed or exited!");
             if let Ok(s) = status {
                eprintln!("   Exit Code: {:?}", s.code());
            }
        }
        _ = server_future => {
            eprintln!("❌ CRITICAL: Web Server (Launcher) stopped unexpectedly!");
        }
    }

    println!("🛑 Shutting down entire application due to failure...");

    let _ = suwayomi_proc.kill().await;
    let _ = ocr_proc.kill().await;

    std::process::exit(1);
}

fn load_icon(bytes: &[u8]) -> tray_icon::Icon {
    let (icon_rgba, icon_width, icon_height) = {
        let image = image::load_from_memory(bytes)
            .expect("Failed to load icon bytes")
            .into_rgba8();
        let (width, height) = image.dimensions();
        let rgba = image.into_raw();
        (rgba, width, height)
    };
    tray_icon::Icon::from_rgba(icon_rgba, icon_width, icon_height).expect("Failed to open icon")
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
