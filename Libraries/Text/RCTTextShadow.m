//
//  RCTTextShadow.m
//  RCTText
//
//  Created by Alec Stanford Larson on 12/20/16.
//  Copyright © 2016 Facebook. All rights reserved.
//

#import "RCTTextShadow.h"

#import "RCTConvert.h"
#import "RCTUtils.h"

@implementation RCTTextShadow
{
  CIFilter *_blurFilter;
  UIImage *_shadowBitmap;
  UIImage *_textBitmap;
  CGRect _textFrame;
}

- (instancetype)initWithOptions:(NSDictionary *)options
{
  if (self = [super init]) {
    _offset = [RCTConvert CGSize:options[@"offset"]];
    _color = [RCTConvert UIColor:options[@"color"]] ?: [UIColor blackColor];
    _radius = options[@"radius"] ?: @0;
    _opacity = options[@"opacity"] ?: @1;

    self.backgroundColor = [UIColor clearColor];
  }

  return self;
}

- (void)updateWithOptions:(NSDictionary *)options
{
  self.offset = [RCTConvert CGSize:options[@"offset"]];
  self.color = [RCTConvert UIColor:options[@"color"]] ?: [UIColor blackColor];
  self.radius = options[@"radius"] ?: @0;
  self.opacity = options[@"opacity"] ?: @1;
}

- (void)setOffset:(CGSize)offset
{
  if (CGSizeEqualToSize(offset, _offset) == NO) {
    _offset = offset;
    [self recomputeFrame];
  }
}

- (void)setColor:(UIColor *)color
{
  if ([color isEqual:_color] == NO) {
    _color = color;
    [self redrawShadowBitmap];
  }
}

- (void)setRadius:(NSNumber *)radius
{
  if ([radius isEqualToNumber:_radius] == NO) {
    _radius = radius;
    [self redrawShadowBitmap];
  }
}

- (void)setOpacity:(NSNumber *)opacity
{
  if ([opacity isEqualToNumber:_opacity] == NO) {
    _opacity = opacity;
    [self setNeedsDisplay];
  }
}

- (CGRect)textFrame
{
  return _textFrame;
}

- (UIImage *)textBitmap
{
  return _textBitmap;
}

- (void)setTextFrame:(CGRect)textFrame textBitmap:(UIImage *)textBitmap
{
  _textFrame = textFrame;
  _textBitmap = textBitmap;

  [self redrawShadowBitmap];
}

- (void)redrawShadowBitmap
{
  UIGraphicsBeginImageContextWithOptions(_textFrame.size, NO, RCTScreenScale());

  // Tint the text shadow.
  [_color setFill];
  UIRectFill(_textFrame);
  [_textBitmap drawInRect:_textFrame
                blendMode:kCGBlendModeDestinationIn
                    alpha:1.0];

  _shadowBitmap = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  if (_radius.doubleValue > 0) {
    _shadowBitmap = [self shadowBitmapFromImage:_shadowBitmap blurRadius:_radius];
  }

  [self recomputeFrame];
}

- (void)recomputeFrame
{
  CGRect frame = _textFrame;
  if (_offset.width != 0 || _offset.height != 0) {
    frame = CGRectOffset(frame, _offset.width, _offset.height);
  }

  if (_shadowBitmap) {
    CGSize shadowSize = _shadowBitmap.size;
    shadowSize.width /= RCTScreenScale();
    shadowSize.height /= RCTScreenScale();
    frame = CGRectInset(
      frame,
      MIN(0, frame.size.width - shadowSize.width) / 2,
      MIN(0, frame.size.height - shadowSize.height) / 2
    );
  }

  self.frame = frame;
  [self setNeedsDisplay];
}

- (void)drawRect:(CGRect)rect
{
  if (_textBitmap == nil) {
    return;
  }

  [_shadowBitmap drawInRect:rect
                  blendMode:kCGBlendModeNormal
                      alpha:_opacity.doubleValue];
}

- (UIImage *)shadowBitmapFromImage:(UIImage *)textBitmap
                        blurRadius:(NSNumber *)blurRadius
{
  CIImage *image = [CIImage imageWithCGImage:textBitmap.CGImage];
  CIFilter *blurFilter = [self filterWithBlurRadius:blurRadius];
  [blurFilter setValue:image forKey:kCIInputImageKey];
  image = [blurFilter valueForKey:kCIOutputImageKey];
  return [UIImage imageWithCIImage:image];
}

- (CIFilter *)filterWithBlurRadius:(NSNumber *)blurRadius
{
  CIFilter *filter = _blurFilter;
  if (filter) {
    NSNumber *inputRadius = [filter valueForKey:@"inputRadius"];
    if ([blurRadius isEqualToNumber:inputRadius] == NO) {
      [filter setValue:blurRadius forKey:@"inputRadius"];
    }
    return filter;
  }

  filter = [CIFilter filterWithName:@"CIGaussianBlur"];
  [filter setValue:blurRadius forKey:@"inputRadius"];
  return _blurFilter = filter;
}

@end
