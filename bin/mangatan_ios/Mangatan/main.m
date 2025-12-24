#import <UIKit/UIKit.h>
#import "AppDelegate.h"
#include "jni.h"
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>

extern void loadfunctions();
extern jint JNI_OnLoad_management(JavaVM *vm, void *reserved);
extern jint JNI_OnLoad_management_ext(JavaVM *vm, void *reserved);

extern void start_rust_server(const char* bundle_path, const char* docs_path);

JavaVM *globalJVM = NULL;

NSString* getDocumentsDirectory() {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    return [paths firstObject];
}

void* run_java_thread(void* arg) {
    fprintf(stderr, "--- [Background] Attaching to JVM ---\n");
    
    JNIEnv *env;
    jint res = (*globalJVM)->AttachCurrentThread(globalJVM, (void**)&env, NULL);
    if (res != JNI_OK) {
        fprintf(stderr, "Failed to attach thread: %d\n", res);
        return NULL;
    }

    jclass threadClass = (*env)->FindClass(env, "java/lang/Thread");
    jclass classLoaderClass = (*env)->FindClass(env, "java/lang/ClassLoader");
    
    jmethodID currentThreadMid = (*env)->GetStaticMethodID(env, threadClass, "currentThread", "()Ljava/lang/Thread;");
    jobject currentThread = (*env)->CallStaticObjectMethod(env, threadClass, currentThreadMid);
    
    jmethodID getSystemClassLoaderMid = (*env)->GetStaticMethodID(env, classLoaderClass, "getSystemClassLoader", "()Ljava/lang/ClassLoader;");
    jobject systemClassLoader = (*env)->CallStaticObjectMethod(env, classLoaderClass, getSystemClassLoaderMid);
    
    jmethodID setContextClassLoaderMid = (*env)->GetMethodID(env, threadClass, "setContextClassLoader", "(Ljava/lang/ClassLoader;)V");
    (*env)->CallVoidMethod(env, currentThread, setContextClassLoaderMid, systemClassLoader);
    
    fprintf(stderr, "--- Context Class Loader Set Successfully ---\n");

    jclass systemClass = (*env)->FindClass(env, "java/lang/System");
    jmethodID setPropMid = (*env)->GetStaticMethodID(env, systemClass, "setProperty", "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    
    jstring key = (*env)->NewStringUTF(env, "os.name");
    jstring val = (*env)->NewStringUTF(env, "Linux");
    (*env)->CallStaticObjectMethod(env, systemClass, setPropMid, key, val);
    
    jclass cls = (*env)->FindClass(env, "suwayomi/tachidesk/MainKt");
    if (cls == NULL) {
        fprintf(stderr, "ERROR: Could not find MainKt\n");
        return NULL;
    }

    jmethodID mid = (*env)->GetStaticMethodID(env, cls, "main", "([Ljava/lang/String;)V");
    if (mid == NULL) return NULL;

    fprintf(stderr, ">>> Invoking Kotlin Main (Blocking) <<<\n");
    (*env)->CallStaticVoidMethod(env, cls, mid, NULL);

    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionDescribe(env);
    }

    (*globalJVM)->DetachCurrentThread(globalJVM);
    return NULL;
}

int main(int argc, char * argv[]) {
    NSString *bundlePath = [[NSBundle mainBundle] resourcePath];
    NSString *docDir = getDocumentsDirectory();
    NSString *libPath = [bundlePath stringByAppendingPathComponent:@"lib"];
    NSString *jarPath = [bundlePath stringByAppendingPathComponent:@"jar/suwayomi-server.jar"];
    NSString *tmpDir = [docDir stringByAppendingPathComponent:@"tmp"];
    
    [[NSFileManager defaultManager] createDirectoryAtPath:tmpDir withIntermediateDirectories:YES attributes:nil error:nil];

    JavaVMInitArgs vm_args;
    JavaVMOption options[30];
    int optCount = 0;

    options[optCount++].optionString = strdup([[NSString stringWithFormat:@"-Djava.home=%@", libPath] UTF8String]);
    options[optCount++].optionString = strdup([[NSString stringWithFormat:@"-Djava.class.path=%@", jarPath] UTF8String]);
    options[optCount++].optionString = strdup([[NSString stringWithFormat:@"-Duser.dir=%@", docDir] UTF8String]);
    options[optCount++].optionString = strdup([[NSString stringWithFormat:@"-Djava.io.tmpdir=%@", tmpDir] UTF8String]);
    
    options[optCount++].optionString = "-Djava.awt.headless=true";
    options[optCount++].optionString = "-Dos.name=Linux";
    options[optCount++].optionString = "-Dos.version=5.15.0";
    options[optCount++].optionString = "-Dos.arch=aarch64";
    
    options[optCount++].optionString = "-Dsuwayomi.tachidesk.config.server.ip =\"127.0.0.1\"";
    options[optCount++].optionString = "-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false";
    options[optCount++].optionString = "-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false";
    options[optCount++].optionString = strdup([[NSString stringWithFormat:@"-Dsuwayomi.tachidesk.config.server.rootDir=%@", docDir] UTF8String]);

    vm_args.version = JNI_VERSION_1_8;
    vm_args.nOptions = optCount;
    vm_args.options = options;
    vm_args.ignoreUnrecognized = JNI_TRUE;

    loadfunctions();
    
    fprintf(stderr, "Creating JavaVM on Main Thread...\n");
    JNIEnv *env; 
    jint res = JNI_CreateJavaVM(&globalJVM, (void **)&env, &vm_args);

    if (res != JNI_OK) {
        fprintf(stderr, "Failed to create JVM: %d\n", res);
        return 1;
    }
    
    JNI_OnLoad_management(globalJVM, NULL);
    JNI_OnLoad_management_ext(globalJVM, NULL);

    fprintf(stderr, "Starting Rust Server...\n");
    start_rust_server([bundlePath UTF8String], [docDir UTF8String]);

    fprintf(stderr, "Spawning Java Thread...\n");
    pthread_t thread;
    pthread_attr_t attrs;
    pthread_attr_init(&attrs);
    pthread_attr_setstacksize(&attrs, 16 * 1024 * 1024); 
    pthread_create(&thread, &attrs, run_java_thread, NULL);
    pthread_attr_destroy(&attrs);

    NSString * appDelegateClassName;
    @autoreleasepool {
        appDelegateClassName = NSStringFromClass([AppDelegate class]);
    }
    return UIApplicationMain(argc, argv, nil, appDelegateClassName);
}
