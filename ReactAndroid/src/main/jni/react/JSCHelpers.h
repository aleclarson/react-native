// Copyright 2004-present Facebook. All Rights Reserved.

#pragma once

#include <JavaScriptCore/JSContextRef.h>
#include <JavaScriptCore/JSObjectRef.h>
#include <JavaScriptCore/JSValueRef.h>

#define throwJSExecutionException(...) jni::throwNewJavaException("com/facebook/react/bridge/JSExecutionException", __VA_ARGS__)
<<<<<<< HEAD

#define throwJSExecutionException(...) jni::throwNewJavaException("com/facebook/react/bridge/JSExecutionException", __VA_ARGS__)
=======
>>>>>>> 0.20-stable

namespace facebook {
namespace react {

void installGlobalFunction(
    JSGlobalContextRef ctx,
    const char* name,
    JSObjectCallAsFunctionCallback callback);

JSValueRef makeJSCException(
    JSContextRef ctx,
    const char* exception_text);

<<<<<<< HEAD
JSValueRef evaluateScript(JSContextRef context, JSStringRef script, JSStringRef source);
=======
JSValueRef evaluateScript(JSContextRef context, JSStringRef script, JSStringRef source, const char *cachePath = nullptr);
>>>>>>> 0.20-stable

} }
