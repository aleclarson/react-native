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
  CGSize _offset;
  UIColor *_color;
  CGFloat _radius;
}

- (instancetype)initWithOptions:(NSDictionary *)options
{
  if (self = [super init]) {
    _offset = [RCTConvert CGSize:options[@"offset"]];
    _color = [RCTConvert UIColor:options[@"color"]] ?: [UIColor blackColor];

    NSNumber *radius = options[@"radius"] ?: @0;
    _radius = radius.doubleValue;

    NSNumber *opacity = options[@"opacity"] ?: @1;
    self.alpha = opacity.doubleValue;
    self.backgroundColor = [UIColor clearColor];
  }

  return self;
}

- (void)updateWithOptions:(NSDictionary *)options
{
  RCTAssertMainQueue();

  BOOL willRedraw = NO;

  CGSize offset = [RCTConvert CGSize:options[@"offset"]];
  if (CGSizeEqualToSize(offset, _offset) == NO) {
    _offset = offset;
    [self recomputeFrame];
  }

  UIColor *color = [RCTConvert UIColor:options[@"color"]] ?: [UIColor blackColor];
  if ([color isEqual:_color] == NO) {
    _color = color;
    willRedraw = YES;
  }

  NSNumber *radius = options[@"radius"] ?: @0;
  if (radius.doubleValue != _radius) {
    _radius = radius.doubleValue;
    willRedraw = YES;
  }

  NSNumber *opacity = options[@"opacity"] ?: @1;
  self.alpha = opacity.doubleValue;

  if (willRedraw) {
    [self redrawShadowBitmap];
  }
}

- (void)setTextBitmap:(UIImage *)textBitmap
{
  RCTAssertMainQueue();
  if (textBitmap != _textBitmap) {
    _textBitmap = textBitmap;
    [self redrawShadowBitmap];
  }
}

- (void)redrawShadowBitmap
{
  CGSize previousShadowSize = _shadowBitmap ? _shadowBitmap.size : CGSizeZero;

  CGSize textSize = _textBitmap ? _textBitmap.size : CGSizeZero;
  if (textSize.width == 0 || textSize.height == 0) {
    _shadowBitmap = nil;
  }
  else {
    CGRect textFrame = (CGRect){CGPointZero, textSize};
    UIGraphicsBeginImageContextWithOptions(textSize, NO, RCTScreenScale());

    // Tint the text shadow.
    [_color setFill];
    UIRectFill(textFrame);
    [_textBitmap drawInRect:textFrame
                  blendMode:kCGBlendModeDestinationIn
                      alpha:1.0];

    _shadowBitmap = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();

    if (_radius > 0) {
      _shadowBitmap = [self shadowBitmapFromImage:_shadowBitmap blurRadius:_radius];
    }
  }

  CGSize nextShadowSize = _shadowBitmap ? _shadowBitmap.size : CGSizeZero;
  if (CGSizeEqualToSize(nextShadowSize, previousShadowSize) == NO) {
    [self recomputeFrame];
  }

  [self setNeedsDisplay];
}

- (void)recomputeFrame
{
  CGRect frame = {
    {_offset.width, _offset.height},
    _textBitmap.size
  };

  if (_shadowBitmap) {
    CGSize shadowSize = _shadowBitmap.size;
    frame = CGRectInset(
      frame,
      MIN(0, frame.size.width - shadowSize.width) / 2,
      MIN(0, frame.size.height - shadowSize.height) / 2
    );
  }

  self.frame = frame;
}

- (void)drawRect:(CGRect)rect
{
  [_shadowBitmap drawInRect:rect
                  blendMode:kCGBlendModeNormal
                      alpha:1.0];
}

- (UIImage *)shadowBitmapFromImage:(UIImage *)textBitmap
                        blurRadius:(CGFloat)blurRadius
{
  if (_blurFilter) {
    NSNumber *previousRadius = [_blurFilter valueForKey:@"inputRadius"];
    if (blurRadius != previousRadius.doubleValue) {
      [_blurFilter setValue:@(blurRadius) forKey:@"inputRadius"];
    }
  } else {
    _blurFilter = [CIFilter filterWithName:@"CIGaussianBlur"];
    [_blurFilter setValue:@(blurRadius) forKey:@"inputRadius"];
  }
  CIImage *image = [CIImage imageWithCGImage:textBitmap.CGImage];
  [_blurFilter setValue:image forKey:kCIInputImageKey];
  image = [_blurFilter valueForKey:kCIOutputImageKey];
  return [UIImage imageWithCIImage:image];
}

@end
