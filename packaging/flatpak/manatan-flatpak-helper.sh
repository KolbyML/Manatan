#!/bin/sh
set -eu

cef_root=/app/lib/cef

# The helper is a standalone Rust executable. Unlike the Flutter runner, no
# plugin has loaded CEF before its dynamic symbols are resolved, so preload the
# exact Flatpak-owned CEF library for this process only. cef-dll-sys otherwise
# assumes a distro Flatpak CEF in /usr/lib whenever FLATPAK is set; Manatan
# intentionally packages its pinned runtime in /app/lib/cef instead.
unset FLATPAK
export CEF_PATH="$cef_root"
export MANATAN_CEF_ROOT="$cef_root"
export WEBVIEW_CEF_CEF_ROOT="$cef_root"
export LD_LIBRARY_PATH="$cef_root${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export LD_PRELOAD="$cef_root/libcef.so${LD_PRELOAD:+:$LD_PRELOAD}"

exec /app/lib/manatan/manatan-helper "$@"
