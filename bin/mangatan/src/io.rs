#[cfg(feature = "embed-jre")]
use std::io::{self, Cursor};
use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};

use tracing::info;

#[cfg(feature = "embed-jre")]
static JRE_BYTES: &[u8] = include_bytes!("../../../bin/mangatan/resources/jre_bundle.zip");

pub fn extract_file(dir: &Path, name: &str, bytes: &[u8]) -> std::io::Result<PathBuf> {
    let path = dir.join(name);
    info!("Extracting file to {}", path.display());
    if path.exists() {
        info!("   Existing file found. Removing...");
        fs::remove_file(&path)?;
        info!("   Old file removed.");
    }
    info!("   Writing new file...");
    let mut file = File::create(&path)?;
    info!("   Writing {} bytes...", bytes.len());
    file.write_all(bytes)?;
    info!("   File extraction complete.");
    Ok(path)
}

#[allow(unused_variables)]
pub fn resolve_java(data_dir: &Path) -> std::io::Result<PathBuf> {
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
            info!("📦 Extracting Embedded JRE...");
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
        info!("🛠️ Development Mode: Using System Java");
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

#[cfg(feature = "embed-jre")]
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
