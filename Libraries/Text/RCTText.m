/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTText.h"

#import "RCTShadowText.h"
#import "RCTTextShadow.h"
#import "RCTUtils.h"
#import "UIView+React.h"

@implementation RCTText
{
  NSMutableArray<RCTTextShadow *> *_shadowViews;
  UIImageView *_textBitmap;
  NSTextStorage *_textStorage;
  CAShapeLayer *_highlightLayer;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    _textStorage = [NSTextStorage new];
    self.isAccessibilityElement = YES;
    self.accessibilityTraits |= UIAccessibilityTraitStaticText;

    self.opaque = NO;
    self.contentMode = UIViewContentModeRedraw;
  }
  return self;
}

- (NSString *)description
{
  NSString *superDescription = super.description;
  NSRange semicolonRange = [superDescription rangeOfString:@";"];
  NSString *replacement = [NSString stringWithFormat:@"; reactTag: %@; text: %@", self.reactTag, self.textStorage.string];
  return [superDescription stringByReplacingCharactersInRange:semicolonRange withString:replacement];
}

- (void)reactSetFrame:(CGRect)frame
{
  // Text looks super weird if its frame is animated.
  // This disables the frame animation, without affecting opacity, etc.
  [UIView performWithoutAnimation:^{
    [super reactSetFrame:frame];
  }];
}

- (void)reactSetInheritedBackgroundColor:(UIColor *)inheritedBackgroundColor
{
  self.backgroundColor = inheritedBackgroundColor;
}

- (void)didUpdateReactSubviews
{
  // Do nothing, as subviews are managed by `setTextStorage:` method
}

- (void)setTextFrame:(CGRect)textFrame
{
  _textFrame = textFrame;

  if (_textBitmap) {
    _textBitmap.frame = textFrame;
  }
}

- (void)setTextStorage:(NSTextStorage *)textStorage
{
  if (_textStorage != textStorage) {
    _textStorage = textStorage;

    if (_textShadows) {
      if (_textStorage.length > 0) {
        [self redrawTextBitmap];
      }
      else if (_textBitmap.image) {
        _textBitmap.image = nil;
        for (RCTTextShadow *shadow in _shadowViews) {
          shadow.textBitmap = nil;
        }
      }
    }

    [self updateHighlight];
  }
}

- (void)setTextShadows:(NSArray<NSDictionary *> *)textShadows
{
  if (textShadows.count == 0) {
    textShadows = nil;
  }
  if (textShadows == _textShadows) {
    return;
  }

  // Clear any text drawn directly into `self`.
  // Then we'll use a `UIImageView` to display the
  // rasterized text above any `RCTTextShadow` views.
  if (_textShadows == nil) {
    [self setNeedsDisplay];
  }

  _textShadows = textShadows;

  if (textShadows == nil) {
    [_textBitmap removeFromSuperview];
    _textBitmap = nil;

    for (RCTTextShadow *view in _shadowViews) {
      [view removeFromSuperview];
    }
    _shadowViews = nil;

    [self setNeedsDisplay];
    return;
  }

  if (_shadowViews == nil) {
    _shadowViews = [NSMutableArray array];
  }

  NSUInteger viewCount = _shadowViews.count;
  NSUInteger maxIndex = textShadows.count - 1;

  // Create a `RCTTextShadow` view for each NSDictionary. Reuse existing views.
  [textShadows enumerateObjectsUsingBlock:^(NSDictionary * _Nonnull options, NSUInteger index, BOOL * _Nonnull stop) {
    if (index < viewCount) {
      RCTTextShadow *view = _shadowViews[index];
      [view updateWithOptions:options];
    }
    else {
      RCTTextShadow *view = [[RCTTextShadow alloc] initWithOptions:options];
      [_shadowViews addObject:view];

      // Display shadows in reverse order
      [self insertSubview:view atIndex:maxIndex - index];
    }
  }];

  // Remove `RCTTextShadow` views no longer in use.
  NSInteger removedCount = viewCount - textShadows.count;
  if (removedCount > 0) {
    NSInteger index = viewCount;
    NSUInteger stopIndex = index - removedCount;
    while (--index >= stopIndex) {
      [_shadowViews[index] removeFromSuperview];
    }
    [_shadowViews removeObjectsInRange:(NSRange){stopIndex, removedCount}];
  }

  if (_textBitmap) {
    [self bringSubviewToFront:_textBitmap];
  }
  else {
    _textBitmap = [[UIImageView alloc] initWithFrame:_textFrame];
    [self addSubview:_textBitmap];
  }
}

- (void)redrawTextBitmap
{
  UIGraphicsBeginImageContextWithOptions(_textFrame.size, NO, RCTScreenScale());

  [self drawTextGlyphs];
  UIImage *textBitmap = UIGraphicsGetImageFromCurrentImageContext();

  UIGraphicsEndImageContext();

  _textBitmap.image = textBitmap;

  for (RCTTextShadow *shadow in _shadowViews) {
    shadow.textBitmap = textBitmap;
  }
}

- (void)drawRect:(CGRect)rect
{
  [self drawTextBackground];

  // When shadows are wanted, the text is displayed
  // using a UIImageView, instead of using `drawRect`.
  if (_textShadows == nil) {
    [self drawTextGlyphs];
  }
}

- (void)drawTextGlyphs
{
  NSLayoutManager *layoutManager = [_textStorage.layoutManagers firstObject];
  NSTextContainer *textContainer = [layoutManager.textContainers firstObject];
  NSRange glyphRange = [layoutManager glyphRangeForTextContainer:textContainer];

  [layoutManager drawGlyphsForGlyphRange:glyphRange atPoint:self.textFrame.origin];
}

- (void)drawTextBackground
{
  NSLayoutManager *layoutManager = [_textStorage.layoutManagers firstObject];
  NSTextContainer *textContainer = [layoutManager.textContainers firstObject];
  NSRange glyphRange = [layoutManager glyphRangeForTextContainer:textContainer];

  [layoutManager drawBackgroundForGlyphRange:glyphRange atPoint:self.textFrame.origin];
}

- (void)updateHighlight
{
  NSLayoutManager *layoutManager = [_textStorage.layoutManagers firstObject];
  NSTextContainer *textContainer = [layoutManager.textContainers firstObject];
  NSRange glyphRange = [layoutManager glyphRangeForTextContainer:textContainer];

  __block UIBezierPath *highlightPath = nil;
  NSRange characterRange = [layoutManager characterRangeForGlyphRange:glyphRange actualGlyphRange:NULL];
  [layoutManager.textStorage enumerateAttribute:RCTIsHighlightedAttributeName inRange:characterRange options:0 usingBlock:^(NSNumber *value, NSRange range, BOOL *_) {
    if (!value.boolValue) {
      return;
    }

    [layoutManager enumerateEnclosingRectsForGlyphRange:range withinSelectedGlyphRange:range inTextContainer:textContainer usingBlock:^(CGRect enclosingRect, __unused BOOL *__) {
      UIBezierPath *path = [UIBezierPath bezierPathWithRoundedRect:CGRectInset(enclosingRect, -2, -2) cornerRadius:2];
      if (highlightPath) {
        [highlightPath appendPath:path];
      } else {
        highlightPath = path;
      }
    }];
  }];

  if (highlightPath) {
    if (!_highlightLayer) {
      _highlightLayer = [CAShapeLayer layer];
      _highlightLayer.fillColor = [UIColor colorWithWhite:0 alpha:0.25].CGColor;
      [self.layer addSublayer:_highlightLayer];
    }
    _highlightLayer.position = (CGPoint){_contentInset.left, _contentInset.top};
    _highlightLayer.path = highlightPath.CGPath;
  } else {
    [_highlightLayer removeFromSuperlayer];
    _highlightLayer = nil;
  }
}

- (NSNumber *)reactTagAtPoint:(CGPoint)point
{
  NSNumber *reactTag = self.reactTag;

  CGFloat fraction;
  NSLayoutManager *layoutManager = _textStorage.layoutManagers.firstObject;
  NSTextContainer *textContainer = layoutManager.textContainers.firstObject;
  NSUInteger characterIndex = [layoutManager characterIndexForPoint:point
                                                    inTextContainer:textContainer
                           fractionOfDistanceBetweenInsertionPoints:&fraction];

  // If the point is not before (fraction == 0.0) the first character and not
  // after (fraction == 1.0) the last character, then the attribute is valid.
  if (_textStorage.length > 0 && (fraction > 0 || characterIndex > 0) && (fraction < 1 || characterIndex < _textStorage.length - 1)) {
    reactTag = [_textStorage attribute:RCTReactTagAttributeName atIndex:characterIndex effectiveRange:NULL];
  }
  return reactTag;
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];

  if (!self.window) {
    self.layer.contents = nil;
    if (_highlightLayer) {
      [_highlightLayer removeFromSuperlayer];
      _highlightLayer = nil;
    }
  } else if (_textStorage.length) {
    [self setNeedsDisplay];
  }
}


#pragma mark - Accessibility

- (NSString *)accessibilityLabel
{
  return _textStorage.string;
}

@end
