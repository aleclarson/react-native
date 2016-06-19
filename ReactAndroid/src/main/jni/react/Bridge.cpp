// Copyright 2004-present Facebook. All Rights Reserved.

#include "Bridge.h"

#include "Executor.h"
#include "MethodCall.h"

#ifdef WITH_FBSYSTRACE
#include <fbsystrace.h>
using fbsystrace::FbSystraceSection;
#endif

namespace facebook {
namespace react {

<<<<<<< HEAD
class JSThreadState {
public:
  JSThreadState(const RefPtr<JSExecutorFactory>& jsExecutorFactory, Bridge::Callback&& callback) :
    m_callback(callback)
  {
    m_jsExecutor = jsExecutorFactory->createJSExecutor([this, callback] (std::string queueJSON, bool isEndOfBatch) {
      m_callback(parseMethodCalls(queueJSON), false /* = isEndOfBatch */);
    });
  }

  void executeApplicationScript(const std::string& script, const std::string& sourceURL) {
    m_jsExecutor->executeApplicationScript(script, sourceURL);
  }

  void flush() {
    auto returnedJSON = m_jsExecutor->flush();
    m_callback(parseMethodCalls(returnedJSON), true /* = isEndOfBatch */);
  }

  void callFunction(const double moduleId, const double methodId, const folly::dynamic& arguments) {
    auto returnedJSON = m_jsExecutor->callFunction(moduleId, methodId, arguments);
    m_callback(parseMethodCalls(returnedJSON), true /* = isEndOfBatch */);
  }

  void invokeCallback(const double callbackId, const folly::dynamic& arguments) {
    auto returnedJSON = m_jsExecutor->invokeCallback(callbackId, arguments);
    m_callback(parseMethodCalls(returnedJSON), true /* = isEndOfBatch */);
  }

  void setGlobalVariable(const std::string& propName, const std::string& jsonValue) {
    m_jsExecutor->setGlobalVariable(propName, jsonValue);
  }

  bool supportsProfiling() {
    return m_jsExecutor->supportsProfiling();
  }

  void startProfiler(const std::string& title) {
    m_jsExecutor->startProfiler(title);
  }

  void stopProfiler(const std::string& title, const std::string& filename) {
    m_jsExecutor->stopProfiler(title, filename);
  }

  void handleMemoryPressureModerate() {
    m_jsExecutor->handleMemoryPressureModerate();
  }

  void handleMemoryPressureCritical() {
    m_jsExecutor->handleMemoryPressureCritical();
  }

private:
  std::unique_ptr<JSExecutor> m_jsExecutor;
  Bridge::Callback m_callback;
};

=======
>>>>>>> 0.20-stable
Bridge::Bridge(const RefPtr<JSExecutorFactory>& jsExecutorFactory, Callback callback) :
  m_callback(std::move(callback)),
  m_destroyed(std::shared_ptr<bool>(new bool(false)))
{
  auto destroyed = m_destroyed;
<<<<<<< HEAD
  auto proxyCallback = [this, destroyed] (std::vector<MethodCall> calls, bool isEndOfBatch) {
    if (*destroyed) {
      return;
    }
    m_callback(std::move(calls), isEndOfBatch);
  };
  m_threadState.reset(new JSThreadState(jsExecutorFactory, std::move(proxyCallback)));
=======
  m_jsExecutor = jsExecutorFactory->createJSExecutor([this, destroyed] (std::string queueJSON, bool isEndOfBatch) {
    if (*destroyed) {
      return;
    }
    m_callback(parseMethodCalls(queueJSON), isEndOfBatch);
  });
>>>>>>> 0.20-stable
}

// This must be called on the same thread on which the constructor was called.
Bridge::~Bridge() {
  *m_destroyed = true;
  m_jsExecutor.reset();
}

void Bridge::executeApplicationScript(const std::string& script, const std::string& sourceURL) {
  m_jsExecutor->executeApplicationScript(script, sourceURL);
}

void Bridge::loadApplicationUnbundle(
    JSModulesUnbundle&& unbundle,
    const std::string& startupCode,
    const std::string& sourceURL) {
  m_jsExecutor->loadApplicationUnbundle(std::move(unbundle), startupCode, sourceURL);
}

void Bridge::flush() {
  if (*m_destroyed) {
    return;
  }
<<<<<<< HEAD
  m_threadState->flush();
}

void Bridge::callFunction(const double moduleId, const double methodId, const folly::dynamic& arguments) {
  if (*m_destroyed) {
    return;
  }
  #ifdef WITH_FBSYSTRACE
  FbSystraceSection s(TRACE_TAG_REACT_CXX_BRIDGE, "Bridge.callFunction");
  #endif
  m_threadState->callFunction(moduleId, methodId, arguments);
}

void Bridge::invokeCallback(const double callbackId, const folly::dynamic& arguments) {
=======
  auto returnedJSON = m_jsExecutor->flush();
  m_callback(parseMethodCalls(returnedJSON), true /* = isEndOfBatch */);
}

void Bridge::callFunction(const double moduleId, const double methodId, const folly::dynamic& arguments) {
>>>>>>> 0.20-stable
  if (*m_destroyed) {
    return;
  }
  #ifdef WITH_FBSYSTRACE
<<<<<<< HEAD
  FbSystraceSection s(TRACE_TAG_REACT_CXX_BRIDGE, "Bridge.invokeCallback");
  #endif
  m_threadState->invokeCallback(callbackId, arguments);
=======
  FbSystraceSection s(TRACE_TAG_REACT_CXX_BRIDGE, "Bridge.callFunction");
  #endif
  auto returnedJSON = m_jsExecutor->callFunction(moduleId, methodId, arguments);
  m_callback(parseMethodCalls(returnedJSON), true /* = isEndOfBatch */);
}

void Bridge::invokeCallback(const double callbackId, const folly::dynamic& arguments) {
  if (*m_destroyed) {
    return;
  }
  #ifdef WITH_FBSYSTRACE
  FbSystraceSection s(TRACE_TAG_REACT_CXX_BRIDGE, "Bridge.invokeCallback");
  #endif
  auto returnedJSON = m_jsExecutor->invokeCallback(callbackId, arguments);
  m_callback(parseMethodCalls(returnedJSON), true /* = isEndOfBatch */);
>>>>>>> 0.20-stable
}

void Bridge::setGlobalVariable(const std::string& propName, const std::string& jsonValue) {
  m_jsExecutor->setGlobalVariable(propName, jsonValue);
}

bool Bridge::supportsProfiling() {
  return m_jsExecutor->supportsProfiling();
}

void Bridge::startProfiler(const std::string& title) {
  m_jsExecutor->startProfiler(title);
}

void Bridge::stopProfiler(const std::string& title, const std::string& filename) {
  m_jsExecutor->stopProfiler(title, filename);
}

void Bridge::handleMemoryPressureModerate() {
  m_jsExecutor->handleMemoryPressureModerate();
}

void Bridge::handleMemoryPressureCritical() {
  m_jsExecutor->handleMemoryPressureCritical();
}

void Bridge::handleMemoryPressureModerate() {
  m_threadState->handleMemoryPressureModerate();
}

void Bridge::handleMemoryPressureCritical() {
  m_threadState->handleMemoryPressureCritical();
}

} }
