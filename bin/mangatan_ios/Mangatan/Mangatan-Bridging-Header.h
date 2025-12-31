#ifndef Mangatan_Bridging_Header_h
#define Mangatan_Bridging_Header_h

#include <stdbool.h>
#include <stdint.h>

void start_rust_server(const char* bundle_path, const char* docs_path, const char* version);

bool is_server_ready(void);

#endif
