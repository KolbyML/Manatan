// #![cfg(target_os = "ios")]

use std::{
    ffi::CStr,
    net::SocketAddr,
    os::raw::c_char,
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
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
use futures::{SinkExt, StreamExt};
use reqwest::Client;
use serde::Serialize;
use socket2::{Domain, Protocol, Socket, Type};
use tokio::{fs as tokio_fs, runtime::Runtime};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{
        client::IntoClientRequest,
        protocol::{Message as TungsteniteMessage, frame::coding::CloseCode},
    },
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::{error, info, warn};

#[derive(Clone)]
struct AppState {
    client: Client,
    webui_dir: PathBuf,
    app_version: String,
}

#[derive(Serialize)]
struct VersionResponse {
    version: String,
    variant: String,
}

// Global state used by Objective-C to determine if it should show the WebView
static SERVER_READY: AtomicBool = AtomicBool::new(false);

#[unsafe(no_mangle)]
pub extern "C" fn is_server_ready() -> bool {
    SERVER_READY.load(Ordering::Relaxed)
}

#[allow(clippy::missing_safety_doc)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn start_rust_server(
    bundle_path: *const c_char,
    docs_path: *const c_char,
    version: *const c_char,
) {
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .try_init();

    info!("🚀 [RUST] Starting Backend Services...");

    let docs_str = unsafe {
        CStr::from_ptr(docs_path)
            .to_str()
            .expect("Expect to convert cstr to str")
    };
    let docs = PathBuf::from(docs_str);
    let bundle_str = unsafe {
        CStr::from_ptr(bundle_path)
            .to_str()
            .expect("Expect to convert cstr to str")
    };
    let version_str = unsafe { CStr::from_ptr(version).to_str().unwrap().to_string() };
    let bundle = PathBuf::from(bundle_str);

    thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread() // <--- Key Change
            .enable_all()
            .build()
            .expect("Should be able to get tokio runtime");

        rt.block_on(async {
            // Spawn the health check as a task within the SAME runtime
            tokio::spawn(async {
                run_health_check_loop().await;
            });

            // Run the server on the main task
            if let Err(e) = start_web_server(bundle, docs, version_str).await {
                error!("❌ Axum Server failed: {}", e);
            }
        });
    });
}

async fn run_health_check_loop() {
    let client = Client::new();
    let query_payload = r#"{"query": "{ __schema { queryType { name } } }"}"#;

    loop {
        let request = client
            .post("http://127.0.0.1:4568/api/graphql")
            .header("Content-Type", "application/json")
            .body(query_payload);

        match request.send().await {
            Ok(resp) if resp.status().is_success() || resp.status() == StatusCode::UNAUTHORIZED => {
                if !SERVER_READY.load(Ordering::Relaxed) {
                    info!("✅ [POLL] Server detected! Signaling UI to load...");
                    SERVER_READY.store(true, Ordering::Relaxed);
                }
            }
            _ => {
                if SERVER_READY.load(Ordering::Relaxed) {
                    warn!("⚠️ [POLL] Server lost connection! Signaling UI to show loading...");
                    SERVER_READY.store(false, Ordering::Relaxed);
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

async fn start_web_server(
    bundle_dir: PathBuf,
    data_dir: PathBuf,
    app_version: String,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("🚀 Initializing Axum Proxy Server on port 4568...");
    let ocr_router = manatan_ocr_server::create_router(data_dir.clone());
    let yomitan_router = manatan_yomitan_server::create_router(data_dir.clone());
    let system_router = Router::new().route("/version", any(current_version_handler));
    let state = AppState {
        client: Client::new(),
        webui_dir: bundle_dir.join("webui"),
        app_version,
    };

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

    let proxy_router: Router<AppState> =
        Router::new().route("/api/{*path}", any(proxy_suwayomi_handler));

    let app: Router<AppState> = Router::new()
        .nest_service("/api/ocr", ocr_router)
        .nest_service("/api/yomitan", yomitan_router)
        .nest("/api/system", system_router)
        .merge(proxy_router)
        .fallback(serve_react_app)
        .layer(cors);

    let app_with_state = app.with_state(state);

    let addr: SocketAddr = "127.0.0.1:4568".parse()?;

    // Manually create socket to set SO_REUSEADDR
    let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))?;
    socket.set_reuse_address(true)?;
    socket.set_reuse_port(true)?;

    socket.bind(&addr.into())?;
    socket.listen(128)?;

    let std_listener: std::net::TcpListener = socket.into();
    std_listener.set_nonblocking(true)?; // Required for conversion to async
    let listener = tokio::net::TcpListener::from_std(std_listener)?;
    info!("✅ Web Server listening on 127.0.0.1:4568");
    axum::serve(listener, app_with_state).await?;
    Ok(())
}

async fn serve_react_app(State(state): State<AppState>, uri: Uri) -> impl IntoResponse {
    let path_str = uri.path().trim_start_matches('/');

    if !path_str.is_empty() {
        let file_path = state.webui_dir.join(path_str);

        if file_path.starts_with(&state.webui_dir)
            && file_path.exists()
            && let Ok(content) = tokio_fs::read(&file_path).await
        {
            let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
            return ([(axum::http::header::CONTENT_TYPE, mime.as_ref())], content).into_response();
        }
    }

    let index_path = state.webui_dir.join("index.html");
    info!("📂 Attempting to serve WebUI from: {:?}", index_path);
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
                Some(Ok(msg)) => if let Some(t_msg) = axum_to_tungstenite(msg) && backend_sender.send(t_msg).await.is_err() { break; }

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
                .expect("expect to build response")
        }
        Err(_err) => Response::builder()
            .status(StatusCode::BAD_GATEWAY)
            .body(Body::empty())
            .expect("Expect to build response"),
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
        TungsteniteMessage::Frame(_) => Message::Binary(Bytes::new()),
    }
}

async fn current_version_handler(State(state): State<AppState>) -> impl IntoResponse {
    axum::Json(VersionResponse {
        version: state.app_version,
        variant: "ios".to_string(),
    })
}
