fn main() {
    println!("cargo:rerun-if-env-changed=MANATAN_GDRIVE_CLIENT_ID");
    let client_id = std::env::var("MANATAN_GDRIVE_CLIENT_ID").unwrap_or_default();
    println!("cargo:rustc-env=MANATAN_GDRIVE_CLIENT_ID_COMPILED={client_id}");

    println!("cargo:rerun-if-env-changed=MANATAN_GOOGLE_OAUTH_BROKER_TOKEN");
    let broker_token = std::env::var("MANATAN_GOOGLE_OAUTH_BROKER_TOKEN").unwrap_or_default();
    println!("cargo:rustc-env=MANATAN_GOOGLE_OAUTH_BROKER_TOKEN_COMPILED={broker_token}");

    println!("cargo:rerun-if-env-changed=MANATAN_GOOGLE_OAUTH_BROKER_ENDPOINT");
    let broker_endpoint = std::env::var("MANATAN_GOOGLE_OAUTH_BROKER_ENDPOINT").unwrap_or_default();
    println!("cargo:rustc-env=MANATAN_GOOGLE_OAUTH_BROKER_ENDPOINT_COMPILED={broker_endpoint}");
}
