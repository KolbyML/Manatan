#![cfg(target_os = "android")]

use std::{path::PathBuf, sync::mpsc::Receiver};

use axum::{
    Json, Router,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
};
use eframe::{CreationContext, egui};
use futures::TryStreamExt;
use reqwest::Client;
use tokio::sync::mpsc::Sender;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info, log::LevelFilter};
use winit::platform::android::EventLoopBuilderExtAndroid;

static JRE_ANDROID_BYTES: &[u8] = include_bytes!("../resources/jre_aarch64.zip");
static JAR_BYTES: &[u8] = include_bytes!("../resources/Suwayomi-Server.jar");

fn run_android_backend(data_dir: PathBuf) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    if !data_dir.exists() {
        let _ = std::fs::create_dir_all(&data_dir);
    }

    let jre_dir = data_dir.join("jre");
    let bin_dir = data_dir.join("bin");
    let _ = std::fs::create_dir_all(&bin_dir);

    let _ = io::extract_zip(JRE_ANDROID_BYTES, &jre_dir);
    let jar_path = io::extract_file(&bin_dir, "Suwayomi-Server.jar", JAR_BYTES).unwrap();

    let jre_clone = jre_dir.clone();
    let jar_clone = jar_path.clone();

    std::thread::spawn(move || {
        info!("▶ Starting JVM Thread...");
        unsafe {
            if let Err(e) = self::jvm::start_jvm_and_run_jar(&jre_clone, &jar_clone) {
                error!("❌ JVM Crash: {}", e);
            }
        }
    });

    rt.block_on(async {
        start_proxy_server().await;
    });
}

async fn start_proxy_server() {
    info!("🌍 Starting Android Proxy at http://127.0.0.1:4568");
    let client = Client::new();
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/*path", any(proxy_suwayomi_handler))
        .layer(cors)
        .with_state(client);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:4568").await.unwrap();
    axum::serve(listener, app).await.unwrap();
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
            let stream = resp.bytes_stream().map_err(std::io::Error::other);
            response_builder.body(Body::from_stream(stream)).unwrap()
        }
        Err(e) => {
            error!("Proxy failed: {}", e);
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::empty())
                .unwrap()
        }
    }
}

#[unsafe(no_mangle)]
fn android_main(app: winit::platform::android::activity::AndroidApp) {
    // Log to android output
    android_logger::init_once(
        android_logger::Config::default().with_max_level(log::LevelFilter::Info),
    );

    let options = eframe::NativeOptions {
        android_app: Some(app),
        ..Default::default()
    };
    eframe::run_native(
        "My egui App",
        options,
        Box::new(|cc| {
            let data_dir = PathBuf::from(
                std::env::var("ANDROID_FILES_DIR")
                    .unwrap_or("/data/data/com.mangatan.app/files".to_string()),
            );

            let data_dir_clone = data_dir.clone();

            std::thread::spawn(move || {
                run_android_backend(data_dir_clone);
            });
            Ok(Box::new(MyApp::new(cc)))
        }),
    )
    .unwrap()
}

pub struct MyApp {
    demo: egui_demo_lib::DemoWindows,
}

impl MyApp {
    pub fn new(cc: &CreationContext) -> Self {
        egui_extras::install_image_loaders(&cc.egui_ctx);
        Self {
            demo: egui_demo_lib::DemoWindows::default(),
        }
    }
}

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.vertical_centered(|ui| {
                ui.add_space(20.0);
                ui.heading("Mangatan Launcher");
                ui.add_space(20.0);
                if ui.button("Open Web UI").clicked() {
                    let _ = open::that("http://localhost:4568");
                }

                ui.add_space(10.0);

                if ui.button("Open Data Folder").clicked() {}
            });
        });
    }
}
