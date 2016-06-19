/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

package com.facebook.react.bridge;

<<<<<<< HEAD
import com.facebook.react.bridge.queue.CatalystQueueConfiguration;
import com.facebook.react.bridge.queue.CatalystQueueConfigurationImpl;
import com.facebook.react.bridge.queue.CatalystQueueConfigurationSpec;
=======
import com.facebook.react.bridge.queue.ReactQueueConfiguration;
import com.facebook.react.bridge.queue.ReactQueueConfigurationImpl;
import com.facebook.react.bridge.queue.ReactQueueConfigurationSpec;
>>>>>>> 0.20-stable
import com.facebook.react.bridge.queue.MessageQueueThreadSpec;
import com.facebook.react.bridge.queue.QueueThreadExceptionHandler;
import com.facebook.react.uimanager.UIManagerModule;

import org.robolectric.RuntimeEnvironment;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Utility for creating pre-configured instances of core react components for tests.
 */
public class ReactTestHelper {

  /**
   * @return a ReactApplicationContext that has a CatalystInstance mock returned by
   * {@link #createMockCatalystInstance}
   */
  public static ReactApplicationContext createCatalystContextForTest() {
    ReactApplicationContext context =
        new ReactApplicationContext(RuntimeEnvironment.application);
    context.initializeWithInstance(createMockCatalystInstance());
    return context;
  }

  /**
<<<<<<< HEAD
   * @return a CatalystInstance mock that has a default working CatalystQueueConfiguration.
   */
  public static CatalystInstance createMockCatalystInstance() {
    CatalystQueueConfigurationSpec spec = CatalystQueueConfigurationSpec.builder()
        .setJSQueueThreadSpec(MessageQueueThreadSpec.mainThreadSpec())
        .setNativeModulesQueueThreadSpec(MessageQueueThreadSpec.mainThreadSpec())
        .build();
    CatalystQueueConfiguration catalystQueueConfiguration = CatalystQueueConfigurationImpl.create(
=======
   * @return a CatalystInstance mock that has a default working ReactQueueConfiguration.
   */
  public static CatalystInstance createMockCatalystInstance() {
    ReactQueueConfigurationSpec spec = ReactQueueConfigurationSpec.builder()
        .setJSQueueThreadSpec(MessageQueueThreadSpec.mainThreadSpec())
        .setNativeModulesQueueThreadSpec(MessageQueueThreadSpec.mainThreadSpec())
        .build();
    ReactQueueConfiguration ReactQueueConfiguration = ReactQueueConfigurationImpl.create(
>>>>>>> 0.20-stable
        spec,
        new QueueThreadExceptionHandler() {
          @Override
          public void handleException(Exception e) {
            throw new RuntimeException(e);
          }
        });

    CatalystInstance reactInstance = mock(CatalystInstance.class);
<<<<<<< HEAD
    when(reactInstance.getCatalystQueueConfiguration()).thenReturn(catalystQueueConfiguration);
=======
    when(reactInstance.getReactQueueConfiguration()).thenReturn(ReactQueueConfiguration);
>>>>>>> 0.20-stable
    when(reactInstance.getNativeModule(UIManagerModule.class))
        .thenReturn(mock(UIManagerModule.class));

    return reactInstance;
  }
}
