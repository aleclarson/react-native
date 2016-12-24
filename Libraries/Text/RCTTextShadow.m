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
  CIImage *_shadowBitmap;
  UIImage *_textBitmap;
  CGSize _offset;
  UIColor *_color;
  CGFloat _radius;
  CIContext *_shadowContext;
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
    self.enableSetNeedsDisplay = YES;
    self.context = [[EAGLContext alloc] initWithAPI:kEAGLRenderingAPIOpenGLES2];

    _shadowContext = [CIContext contextWithEAGLContext:self.context
                                               options:@{kCIContextWorkingColorSpace: [NSNull null]}];
  }

  return self;
}

- (void)updateWithOptions:(NSDictionary *)options
{
  RCTAssertMainQueue();

  BOOL needsRedraw = NO;

  CGSize offset = [RCTConvert CGSize:options[@"offset"]];
  if (CGSizeEqualToSize(offset, _offset) == NO) {
    _offset = offset;
    [self recomputeFrame];
  }

  UIColor *color = [RCTConvert UIColor:options[@"color"]] ?: [UIColor blackColor];
  if ([color isEqual:_color] == NO) {
    _color = color;
    needsRedraw = YES;
  }

  NSNumber *radius = options[@"radius"] ?: @0;
  if (radius.doubleValue != _radius) {
    _radius = radius.doubleValue;
    needsRedraw = YES;
  }

  NSNumber *opacity = options[@"opacity"] ?: @1;
  self.alpha = opacity.doubleValue;

  if (needsRedraw) {
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
  CGSize textSize = _textBitmap ? _textBitmap.size : CGSizeZero;

  if (textSize.width == 0 || textSize.height == 0) {
    return [self setShadowBitmap:nil];
  }

  CGRect textFrame = (CGRect){CGPointZero, textSize};
  UIGraphicsBeginImageContextWithOptions(textSize, NO, RCTScreenScale());

  [_color setFill];
  UIRectFill(textFrame);

  [_textBitmap drawInRect:textFrame
                blendMode:kCGBlendModeDestinationIn
                    alpha:1.0];

  UIImage *textBitmap = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  CIImage *shadowBitmap = [CIImage imageWithCGImage:textBitmap.CGImage];
  if (_radius > 0) {
    shadowBitmap = [self blurImage:shadowBitmap radius:_radius];
  }
  [self setShadowBitmap:shadowBitmap];
}

- (void)setShadowBitmap:(CIImage *)shadowBitmap
{
  CGRect oldExtent = _shadowBitmap ? _shadowBitmap.extent : CGRectZero;
  CGRect newExtent = shadowBitmap ? shadowBitmap.extent : CGRectZero;

  _shadowBitmap = shadowBitmap;

  if (CGSizeEqualToSize(oldExtent.size, newExtent.size) == NO) {
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
    CGSize shadowSize = _shadowBitmap.extent.size;
    if (_radius > 0) {
      shadowSize.width /= RCTScreenScale();
      shadowSize.height /= RCTScreenScale();
    }
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
  if (_shadowBitmap) {
    CGAffineTransform scale = CGAffineTransformMakeScale(self.contentScaleFactor, self.contentScaleFactor);
    [_shadowContext drawImage:_shadowBitmap
                       inRect:CGRectApplyAffineTransform(rect, scale)
                     fromRect:_shadowBitmap.extent];
  }
}

- (CIImage *)blurImage:(CIImage *)textBitmap
                radius:(CGFloat)blurRadius
{
  if (_blurFilter) {
    NSNumber *previousRadius = [_blurFilter valueForKey:@"inputRadius"];
    if (blurRadius != previousRadius.doubleValue) {
      [_blurFilter setValue:@(blurRadius) forKey:@"inputRadius"];
    }
  }
  else {
    _blurFilter = [CIFilter filterWithName:@"CIGaussianBlur"];
    [_blurFilter setValue:@(blurRadius) forKey:@"inputRadius"];
  }

  [_blurFilter setValue:textBitmap forKey:kCIInputImageKey];
  return [_blurFilter valueForKey:kCIOutputImageKey];
}

@end
