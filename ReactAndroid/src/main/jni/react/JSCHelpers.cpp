// Copyright 2004-present Facebook. All Rights Reserved.

#include "JSCHelpers.h"

#include <JavaScriptCore/JSStringRef.h>
#include <fb/log.h>
#include <jni/fbjni/Exceptions.h>

#include "Value.h"
<<<<<<< HEAD
=======

#if WITH_FBJSCEXTENSIONS
#include <jsc_function_info_cache.h>
#endif
>>>>>>> 0.20-stable

namespace facebook {
namespace react {

void installGlobalFunction(
    JSGlobalContextRef ctx,
    const char* name,
    JSObjectCallAsFunctionCallback callback) {
  JSStringRef jsName = JSStringCreateWithUTF8CString(name);
  JSObjectRef functionObj = JSObjectMakeFunctionWithCallback(
      ctx, jsName, callback);
  JSObjectRef globalObject = JSContextGetGlobalObject(ctx);
  JSObjectSetProperty(ctx, globalObject, jsName, functionObj, 0, NULL);
  JSStringRelease(jsName);
}

JSValueRef makeJSCException(
    JSContextRef ctx,
    const char* exception_text) {
  JSStringRef message = JSStringCreateWithUTF8CString(exception_text);
  JSValueRef exceptionString = JSValueMakeString(ctx, message);
  JSStringRelease(message);
  return JSValueToObject(ctx, exceptionString, NULL);
}

<<<<<<< HEAD
JSValueRef evaluateScript(JSContextRef context, JSStringRef script, JSStringRef source) {
  JSValueRef exn;
  auto result = JSEvaluateScript(context, script, NULL, source, 0, &exn);
=======
JSValueRef evaluateScript(JSContextRef context, JSStringRef script, JSStringRef source, const char *cachePath) {
  JSValueRef exn, result;
#if WITH_FBJSCEXTENSIONS
  if (source){
    // If evaluating an application script, send it through `JSEvaluateScriptWithCache()`
    //  to add cache support.
    result = JSEvaluateScriptWithCache(context, script, NULL, source, 0, &exn, cachePath);
  } else {
    result = JSEvaluateScript(context, script, NULL, source, 0, &exn);
  }
#else
  result = JSEvaluateScript(context, script, NULL, source, 0, &exn);
#endif
>>>>>>> 0.20-stable
  if (result == nullptr) {
    Value exception = Value(context, exn);
    std::string exceptionText = exception.toString().str();
    FBLOGE("Got JS Exception: %s", exceptionText.c_str());
    auto line = exception.asObject().getProperty("line");

<<<<<<< HEAD
    std::ostringstream lineInfo;
    if (line != nullptr && line.isNumber()) {
      lineInfo << " (line " << line.asInteger() << " in the generated bundle)";
    } else {
      lineInfo << " (no line info)";
    }
    throwJSExecutionException("%s%s", exceptionText.c_str(), lineInfo.str().c_str());
=======
    std::ostringstream locationInfo;
    std::string file = source != nullptr ? String::adopt(source).str() : "";
    locationInfo << "(" << (file.length() ? file : "<unknown file>");
    if (line != nullptr && line.isNumber()) {
      locationInfo << ":" << line.asInteger();
    }
    locationInfo << ")";
    throwJSExecutionException("%s %s", exceptionText.c_str(), locationInfo.str().c_str());
>>>>>>> 0.20-stable
  }
  return result;
}

} }
