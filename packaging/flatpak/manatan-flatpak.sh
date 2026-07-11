#!/bin/sh
set -eu

cef_root=/app/lib/cef
export WEBVIEW_CEF_CEF_ROOT="$cef_root"
export MANATAN_CEF_ROOT="$cef_root"
export CEF_PATH="$cef_root"
export WEBVIEW_CEF_USER_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/manatan/cef/flutter-webview"

# The bootstrapper normally owns application updates and CEF provisioning.
# Flatpak owns both for this installation, so expose an always-up-to-date state
# to the UI and never attempt to replace the read-only /app payload.
export MANATAN_DISABLE_BOOTSTRAP=1

# CEF must be visible to the dynamic loader before the Flutter runner starts.
# Preserve Flatpak's existing path so /app/lib and runtime extensions (notably
# ffmpeg-full) remain available to libmpv and Manatan's media helpers.
export LD_LIBRARY_PATH="$cef_root${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# Keep compatibility with already-published payloads whose Rust allocator uses
# the initial-exec TLS model. New payloads no longer require the larger surplus.
case ":${GLIBC_TUNABLES:-}:" in
  *:glibc.rtld.optional_static_tls=*) ;;
  *)
    export GLIBC_TUNABLES="${GLIBC_TUNABLES:+$GLIBC_TUNABLES:}glibc.rtld.optional_static_tls=524288"
    ;;
esac

exec /app/lib/manatan/Manatan "$@"
