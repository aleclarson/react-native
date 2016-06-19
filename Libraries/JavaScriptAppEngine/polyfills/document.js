/* eslint global-strict: 0 */
(function(GLOBAL) {
  /**
   * The document must be shimmed before anything else that might define the
   * `ExecutionEnvironment` module (which checks for `document.createElement`).
   */

  // Override global 'Text' and 'Image' document classes
  // to prevent strange error messages when someone forgets
  // to import the 'Text' or 'Image' module.
  GLOBAL.Text = null;
  GLOBAL.Image = null;

  // There is no DOM so MutationObserver doesn't make sense. It is used
  // as feature detection in Bluebird Promise implementation
  GLOBAL.MutationObserver = undefined;
})(this);
