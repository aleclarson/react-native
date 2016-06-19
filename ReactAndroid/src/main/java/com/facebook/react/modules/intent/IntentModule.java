/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

package com.facebook.react.modules.intent;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

<<<<<<< HEAD
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.JSApplicationIllegalArgumentException;
=======
import com.facebook.react.bridge.JSApplicationIllegalArgumentException;
import com.facebook.react.bridge.Promise;
>>>>>>> 0.20-stable
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Intent module. Launch other activities or open URLs.
 */
public class IntentModule extends ReactContextBaseJavaModule {

  public IntentModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "IntentAndroid";
  }

  /**
   * Return the URL the activity was started with
   *
<<<<<<< HEAD
   * @param callback a callback which is called with the initial URL
   */
  @ReactMethod
  public void getInitialURL(Callback callback) {
=======
   * @param promise a promise which is resolved with the initial URL
   */
  @ReactMethod
  public void getInitialURL(Promise promise) {
>>>>>>> 0.20-stable
    try {
      Activity currentActivity = getCurrentActivity();
      String initialURL = null;

      if (currentActivity != null) {
        Intent intent = currentActivity.getIntent();
        String action = intent.getAction();
        Uri uri = intent.getData();

        if (Intent.ACTION_VIEW.equals(action) && uri != null) {
          initialURL = uri.toString();
        }
      }

<<<<<<< HEAD
      callback.invoke(initialURL);
    } catch (Exception e) {
      throw new JSApplicationIllegalArgumentException(
          "Could not get the initial URL : " + e.getMessage());
=======
      promise.resolve(initialURL);
    } catch (Exception e) {
      promise.reject(new JSApplicationIllegalArgumentException(
          "Could not get the initial URL : " + e.getMessage()));
>>>>>>> 0.20-stable
    }
  }

  /**
   * Starts a corresponding external activity for the given URL.
   *
   * For example, if the URL is "https://www.facebook.com", the system browser will be opened,
   * or the "choose application" dialog will be shown.
   *
   * @param url the URL to open
   */
  @ReactMethod
<<<<<<< HEAD
  public void openURL(String url) {
    if (url == null || url.isEmpty()) {
      throw new JSApplicationIllegalArgumentException("Invalid URL: " + url);
=======
  public void openURL(String url, Promise promise) {
    if (url == null || url.isEmpty()) {
      promise.reject(new JSApplicationIllegalArgumentException("Invalid URL: " + url));
      return;
>>>>>>> 0.20-stable
    }

    try {
      Activity currentActivity = getCurrentActivity();
      Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));

      if (currentActivity != null) {
        currentActivity.startActivity(intent);
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getReactApplicationContext().startActivity(intent);
      }
<<<<<<< HEAD
    } catch (Exception e) {
      throw new JSApplicationIllegalArgumentException(
          "Could not open URL '" + url + "': " + e.getMessage());
=======

      promise.resolve(true);
    } catch (Exception e) {
      promise.reject(new JSApplicationIllegalArgumentException(
          "Could not open URL '" + url + "': " + e.getMessage()));
>>>>>>> 0.20-stable
    }
  }

  /**
   * Determine whether or not an installed app can handle a given URL.
   *
   * @param url the URL to open
<<<<<<< HEAD
   * @param callback a callback that is always called with a boolean argument
   */
  @ReactMethod
  public void canOpenURL(String url, Callback callback) {
    if (url == null || url.isEmpty()) {
      throw new JSApplicationIllegalArgumentException("Invalid URL: " + url);
=======
   * @param promise a promise that is always resolved with a boolean argument
   */
  @ReactMethod
  public void canOpenURL(String url, Promise promise) {
    if (url == null || url.isEmpty()) {
      promise.reject(new JSApplicationIllegalArgumentException("Invalid URL: " + url));
      return;
>>>>>>> 0.20-stable
    }

    try {
      Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
      // We need Intent.FLAG_ACTIVITY_NEW_TASK since getReactApplicationContext() returns
      // the ApplicationContext instead of the Activity context.
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      boolean canOpen =
          intent.resolveActivity(getReactApplicationContext().getPackageManager()) != null;
<<<<<<< HEAD
      callback.invoke(canOpen);
    } catch (Exception e) {
      throw new JSApplicationIllegalArgumentException(
          "Could not check if URL '" + url + "' can be opened: " + e.getMessage());
=======
      promise.resolve(canOpen);
    } catch (Exception e) {
      promise.reject(new JSApplicationIllegalArgumentException(
          "Could not check if URL '" + url + "' can be opened: " + e.getMessage()));
>>>>>>> 0.20-stable
    }
  }
}
