/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTTextLines.h"

#import "RCTConvert.h"
#import "RCTFont.h"
#import "RCTLog.h"

@implementation RCTTextLines
{
  NSMutableArray<NSString *> *_lines;
  NSLayoutManager *_layoutManager;
  NSTextContainer *_textContainer;
  NSTextStorage *_textStorage;
  BOOL _shouldComputeLines;
}

RCT_EXPORT_MODULE();

- (instancetype)init
{
  if (self = [super init]) {
    _lines = [NSMutableArray array];
    _maxWidth = 0;
    _shouldComputeLines = YES;
  }

  return self;
}

RCT_EXPORT_METHOD(computeWidth:(NSString *)text
                     textStyle:(NSDictionary *)textStyle
                      callback:(RCTResponseSenderBlock)callback)
{
  NSNumber *letterSpacing = textStyle[@"letterSpacing"] ?: @0;
  UIFont *font =
    [RCTFont updateFont:nil
             withFamily:textStyle[@"fontFamily"]
                   size:textStyle[@"fontSize"]
                 weight:textStyle[@"fontWeight"]
                  style:textStyle[@"fontStyle"]
                variant:textStyle[@"fontVariant"]
        scaleMultiplier:1.0];

  CGRect bounds =
    [text boundingRectWithSize:CGSizeMake(CGFLOAT_MAX, CGFLOAT_MAX)
                       options:NSStringDrawingUsesLineFragmentOrigin
                    attributes:@{NSFontAttributeName: font, NSKernAttributeName: letterSpacing}
                       context:nil];

  callback(@[
    @(bounds.size.width),
  ]);
}

RCT_EXPORT_METHOD(computeLines:(NSString *)text
                     textStyle:(NSDictionary *)textStyle
                      callback:(RCTResponseSenderBlock)callback)
{
  RCTTextLines *lines = [RCTTextLines new];
  lines.maxWidth = [textStyle[@"width"] floatValue];

  [lines setText:text withStyle:textStyle];

  callback(@[
    lines.array,
  ]);
}

- (NSString *)text
{
  return _textStorage.string;
}

- (NSArray<NSString *> *)array
{
  [self _computeLinesIfNecessary];
  return _lines;
}

- (NSUInteger)count
{
  [self _computeLinesIfNecessary];
  return _lines.count;
}

- (CGRect)frame
{
  if (_textStorage == nil) {
    return CGRectZero;
  }
  return [_textStorage boundingRectWithSize:_textContainer.size
                                    options:NSStringDrawingUsesLineFragmentOrigin
                                    context:nil];
}

- (CGFloat)width
{
  return CGRectGetWidth(self.frame);
}

- (CGFloat)height
{
  return CGRectGetHeight(self.frame);
}

- (void)setMaxWidth:(CGFloat)maxWidth
{
  if (_maxWidth != maxWidth) {
    _maxWidth = maxWidth;

    if (_textContainer != nil) {
      _textContainer.size = CGSizeMake(maxWidth, CGFLOAT_MAX);
    }

    [self _resetLines];
  }
}

- (void)setTextStorage:(NSTextStorage *)textStorage
{
  if (_layoutManager == nil) {
    _textContainer = [NSTextContainer new];
    _textContainer.lineFragmentPadding = 0.0;
    _textContainer.size = CGSizeMake(_maxWidth, CGFLOAT_MAX);

    _layoutManager = [NSLayoutManager new];
    [_layoutManager addTextContainer:_textContainer];
  }

  _textStorage = textStorage;
  [textStorage addLayoutManager:_layoutManager];

  [self _resetLines];
}

- (void)setText:(NSAttributedString *)text
{
  self.textStorage = [[NSTextStorage alloc] initWithAttributedString:text];
}

- (void)setText:(NSString *)text withStyle:(NSDictionary *)style
{
  UIFont *font =
    [RCTFont updateFont:nil
             withFamily:style[@"fontFamily"]
                   size:style[@"fontSize"]
                 weight:style[@"fontWeight"]
                  style:style[@"fontStyle"]
                variant:style[@"fontVariant"]
        scaleMultiplier:1.0];

  [self setText:text
        withFont:font
        letterSpacing:style[@"letterSpacing"]];
}

- (void)setText:(NSString *)text withFont:(UIFont *)font letterSpacing:(NSNumber *)letterSpacing
{
  self.textStorage =
    [[NSTextStorage alloc]
      initWithString:text
          attributes:@{
            NSFontAttributeName: font,
            NSKernAttributeName: letterSpacing ?: @0,
          }];
}

- (NSUInteger)lineIndexFromCharacterIndex:(NSUInteger)charIndex
{
  // An index of zero always matches the first line.
  if (charIndex == 0) {
    return 0;
  }

  NSUInteger lineCount = _lines.count;
  if (lineCount == 0) {
    return NSNotFound;
  }

  NSRange lineRange;
  NSUInteger charOffset = 0;

  for (NSUInteger lineIndex = 0; lineIndex < lineCount; lineIndex++) {
    lineRange = NSMakeRange(charOffset, _lines[lineIndex].length);
    charOffset += lineRange.length;

    if (NSLocationInRange(charIndex, lineRange)) {
      return lineIndex;
    }
  }

  // Treat the final character offset as a valid index.
  if (charIndex == charOffset) {
    return lineCount - 1;
  }

  return NSNotFound;
}

- (NSRange)lineRangeFromCharacterRange:(NSRange)charRange
{
  // For zero-length character ranges, we only need to
  // find the line containing the range's start index.
  if (charRange.length == 0) {
    NSUInteger lineIndex = [self lineIndexFromCharacterIndex:charRange.location];
    if (lineIndex == NSNotFound) {
      return NSMakeRange(0, 0);
    } else {
      return NSMakeRange(lineIndex, 1);
    }
  }

  NSUInteger lineCount = _lines.count;
  if (lineCount == 0) {
    return NSMakeRange(0, 0);
  }

  NSUInteger location = NSNotFound;
  NSUInteger length = 0;

  NSRange lineRange;
  NSUInteger charOffset = 0;

  for (NSUInteger lineIndex = 0; lineIndex < lineCount; lineIndex++) {
    lineRange = NSMakeRange(charOffset, _lines[lineIndex].length);
    charOffset += lineRange.length;

    if (NSIntersectionRange(charRange, lineRange).length > 0) {
      length += 1;
      if (location == NSNotFound) {
        location = lineIndex;
      }
    } else if (location != NSNotFound) {
      break;
    }
  }

  // Check if `charRange` ends with a line break, so we
  // can force inclusion of the newly created empty line.
  NSUInteger lastCharIndex = charRange.location + charRange.length - 1;
  NSString *lastChar = [_textStorage.string substringWithRange:NSMakeRange(lastCharIndex, 1)];
  if ([lastChar isEqual:@"\n"]) {
    length += 1;
  }

  return NSMakeRange(location, length);
}

- (void)_resetLines
{
  if (_shouldComputeLines == NO) {
    _shouldComputeLines = YES;
    [_lines removeAllObjects];
  }
}

- (void)_computeLinesIfNecessary
{
  if (_shouldComputeLines && _textStorage) {
    [self _computeLines:_textStorage.string];
  }
}

- (void)_computeLines:(NSString *)text
{
  _shouldComputeLines = NO;

  // Find any line breaks.
  if (text.length > 0) {
    NSRange charRange;
    NSUInteger maxIndex = _layoutManager.numberOfGlyphs;
    for (NSUInteger index = 0; index < maxIndex; index = NSMaxRange(charRange)) {
      [_layoutManager lineFragmentRectForGlyphAtIndex:index effectiveRange:&charRange];
      if (charRange.length > 0) {
        [_lines addObject:[text substringWithRange:charRange]];
      }
    }

    // If the last line is empty, it's not detected by the for loop above.
    if ([text hasSuffix:@"\n"]) {
      [_lines addObject:@""];
    }
  }

  // Ensure at least one line exists.
  if (_lines.count == 0) {
    [_lines addObject:@""];
  }
}

@end
