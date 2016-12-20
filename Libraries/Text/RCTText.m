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

static void collectNonTextDescendants(RCTText *view, NSMutableArray *nonTextDescendants)
{
  for (UIView *child in view.reactSubviews) {
    if ([child isKindOfClass:[RCTText class]]) {
      collectNonTextDescendants((RCTText *)child, nonTextDescendants);
    } else if (!CGRectEqualToRect(child.frame, CGRectZero)) {
      [nonTextDescendants addObject:child];
    }
  }
}

@implementation RCTText
{
  NSMutableArray<RCTTextShadow *> *_textShadows;
  NSTextStorage *_textStorage;
  CAShapeLayer *_highlightLayer;
  UIImageView *_textBitmap;
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

- (void)setTextStorage:(NSTextStorage *)textStorage
{
  if (_textStorage != textStorage) {
    _textStorage = textStorage;

    // Update subviews
    NSMutableArray *nonTextDescendants = [NSMutableArray new];
    collectNonTextDescendants(self, nonTextDescendants);
    NSArray *subviews = self.subviews;
    if (![subviews isEqualToArray:nonTextDescendants]) {
      for (UIView *child in subviews) {
        if (![nonTextDescendants containsObject:child]) {
          [child removeFromSuperview];
        }
      }
      for (UIView *child in nonTextDescendants) {
        [self addSubview:child];
      }
    }

    [self setNeedsDisplay];
  }
}

- (void)setTextShadows:(NSArray<NSDictionary *> *)textShadows
{
  if (textShadows == nil) {
    if (_textShadows) {
      for (RCTTextShadow *view in _textShadows) {
        [view removeFromSuperview];
      }
      _textShadows = nil;
    }
    return;
  }

  if (_textShadows == nil) {
    _textShadows = [NSMutableArray array];
  }

  NSUInteger viewCount = _textShadows.count;
  NSUInteger maxIndex = textShadows.count - 1;

  // Create a `RCTTextShadow` view for each NSDictionary. Reuse existing views.
  [textShadows enumerateObjectsUsingBlock:^(NSDictionary * _Nonnull options, NSUInteger index, BOOL * _Nonnull stop) {
    if (index < viewCount) {
      RCTTextShadow *view = _textShadows[index];
      [view updateWithOptions:options];
    } else {
      RCTTextShadow *view = [[RCTTextShadow alloc] initWithOptions:options];
      [view setTextFrame:_textFrame textBitmap:_textBitmap.image];
      [_textShadows addObject:view];

      // Display shadows in reverse order
      [self insertSubview:view atIndex:maxIndex - index];
    }
  }];

  // Remove `RCTTextShadow` views no longer in use.
  NSInteger removedCount = _textShadows.count - textShadows.count;
  if (removedCount > 0) {
    NSInteger index = _textShadows.count;
    NSUInteger stopIndex = index - removedCount;
    while (--index >= stopIndex) {
      RCTTextShadow *view = _textShadows[index];
      [view removeFromSuperview];
    }
    [_textShadows removeObjectsInRange:(NSRange){stopIndex, removedCount}];
  }

  if (_textBitmap) {
    [self bringSubviewToFront:_textBitmap];
  }
}

- (void)drawRect:(CGRect)rect
{
  NSLayoutManager *layoutManager = [_textStorage.layoutManagers firstObject];
  NSTextContainer *textContainer = [layoutManager.textContainers firstObject];

  NSRange glyphRange = [layoutManager glyphRangeForTextContainer:textContainer];
  CGRect textFrame = self.textFrame;

  [layoutManager drawBackgroundForGlyphRange:glyphRange atPoint:textFrame.origin];

  if (_textShadows) {
    UIGraphicsBeginImageContextWithOptions(textFrame.size, NO, RCTScreenScale());
  }

  [layoutManager drawGlyphsForGlyphRange:glyphRange atPoint:textFrame.origin];

  if (_textShadows) {
    UIImage *textBitmap = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();

    if (_textBitmap == nil) {
      _textBitmap = [UIImageView new];
      [self addSubview:_textBitmap];
    }

    _textBitmap.image = textBitmap;
    _textBitmap.frame = (CGRect){CGPointZero, textBitmap.size};

    for (RCTTextShadow *shadow in _textShadows) {
      [shadow setTextFrame:_textBitmap.frame
                textBitmap:textBitmap];
    }
  }

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
