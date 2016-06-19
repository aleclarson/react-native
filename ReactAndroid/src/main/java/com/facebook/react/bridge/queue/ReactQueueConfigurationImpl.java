/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

package com.facebook.react.bridge.queue;

<<<<<<< HEAD:ReactAndroid/src/main/java/com/facebook/react/bridge/queue/CatalystQueueConfiguration.java
/**
 * Specifies which {@link MessageQueueThread}s must be used to run the various contexts of
 * execution within catalyst (Main UI thread, native modules, and JS). Some of these queues *may* be
 * the same but should be coded against as if they are different.
 *
 * UI Queue Thread: The standard Android main UI thread and Looper. Not configurable.
 * Native Modules Queue Thread: The thread and Looper that native modules are invoked on.
 * JS Queue Thread: The thread and Looper that JS is executed on.
 */
public interface CatalystQueueConfiguration {
  MessageQueueThread getUIQueueThread();
  MessageQueueThread getNativeModulesQueueThread();
  MessageQueueThread getJSQueueThread();
=======
import java.util.Map;

import android.os.Looper;

import com.facebook.react.common.MapBuilder;

public class ReactQueueConfigurationImpl implements ReactQueueConfiguration {

  private final MessageQueueThreadImpl mUIQueueThread;
  private final MessageQueueThreadImpl mNativeModulesQueueThread;
  private final MessageQueueThreadImpl mJSQueueThread;

  private ReactQueueConfigurationImpl(
      MessageQueueThreadImpl uiQueueThread,
      MessageQueueThreadImpl nativeModulesQueueThread,
      MessageQueueThreadImpl jsQueueThread) {
    mUIQueueThread = uiQueueThread;
    mNativeModulesQueueThread = nativeModulesQueueThread;
    mJSQueueThread = jsQueueThread;
  }

  @Override
  public MessageQueueThread getUIQueueThread() {
    return mUIQueueThread;
  }

  @Override
  public MessageQueueThread getNativeModulesQueueThread() {
    return mNativeModulesQueueThread;
  }

  @Override
  public MessageQueueThread getJSQueueThread() {
    return mJSQueueThread;
  }

  /**
   * Should be called when the corresponding {@link com.facebook.react.bridge.CatalystInstance}
   * is destroyed so that we shut down the proper queue threads.
   */
  public void destroy() {
    if (mNativeModulesQueueThread.getLooper() != Looper.getMainLooper()) {
      mNativeModulesQueueThread.quitSynchronous();
    }
    if (mJSQueueThread.getLooper() != Looper.getMainLooper()) {
      mJSQueueThread.quitSynchronous();
    }
  }

  public static ReactQueueConfigurationImpl create(
      ReactQueueConfigurationSpec spec,
      QueueThreadExceptionHandler exceptionHandler) {
    Map<MessageQueueThreadSpec, MessageQueueThreadImpl> specsToThreads = MapBuilder.newHashMap();

    MessageQueueThreadSpec uiThreadSpec = MessageQueueThreadSpec.mainThreadSpec();
    MessageQueueThreadImpl uiThread =
      MessageQueueThreadImpl.create( uiThreadSpec, exceptionHandler);
    specsToThreads.put(uiThreadSpec, uiThread);

    MessageQueueThreadImpl jsThread = specsToThreads.get(spec.getJSQueueThreadSpec());
    if (jsThread == null) {
      jsThread = MessageQueueThreadImpl.create(spec.getJSQueueThreadSpec(), exceptionHandler);
    }

    MessageQueueThreadImpl nativeModulesThread =
        specsToThreads.get(spec.getNativeModulesQueueThreadSpec());
    if (nativeModulesThread == null) {
      nativeModulesThread =
          MessageQueueThreadImpl.create(spec.getNativeModulesQueueThreadSpec(), exceptionHandler);
    }

    return new ReactQueueConfigurationImpl(uiThread, nativeModulesThread, jsThread);
  }
>>>>>>> 0.20-stable:ReactAndroid/src/main/java/com/facebook/react/bridge/queue/ReactQueueConfigurationImpl.java
}
