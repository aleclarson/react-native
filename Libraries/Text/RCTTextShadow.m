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
  BOOL _pendingRedraw;
  int _redrawTimer;
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
  if (self.layer.needsDisplay) {
    _pendingRedraw = YES;
    _redrawTimer = RCTStartTimer(@"Performed pending redraw");
    return;
  }

  CGSize textSize = _textBitmap ? _textBitmap.size : CGSizeZero;
  NSLog(@"RCTTextShadow.redrawShadowBitmap: (textSize = %@, blurRadius = %f)", NSStringFromCGSize(textSize), _radius);

  if (textSize.width == 0 || textSize.height == 0) {
    return [self setShadowBitmap:nil];
  }

  CGRect textFrame = (CGRect){CGPointZero, textSize};
  UIGraphicsBeginImageContextWithOptions(textSize, NO, RCTScreenScale());

  // Tint the text shadow.
  [_color setFill];
  UIRectFill(textFrame);
  [_textBitmap drawInRect:textFrame
                blendMode:kCGBlendModeDestinationIn
                    alpha:1.0];

  __block UIImage *shadowBitmap = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  CGFloat radius = _radius;
  if (radius == 0) {
    return [self setShadowBitmap:shadowBitmap];
  }

  int blurTimer = RCTStartTimer(@"Blurred the shadow bitmap");
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
    shadowBitmap = [self shadowBitmapFromImage:shadowBitmap blurRadius:radius];
    RCTExecuteOnMainQueue(^{
      [self setShadowBitmap:shadowBitmap];
      RCTStopTimer(blurTimer);
    });
  });
}

- (void)setShadowBitmap:(UIImage *)shadowBitmap
{
  CGSize previousShadowSize = _shadowBitmap ? _shadowBitmap.size : CGSizeZero;
  CGSize nextShadowSize = shadowBitmap ? shadowBitmap.size : CGSizeZero;

  _shadowBitmap = shadowBitmap;

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
  int drawTimer = RCTStartTimer(@"[RCTTextShadow drawRect]");

  [_shadowBitmap drawInRect:rect
                  blendMode:kCGBlendModeNormal
                      alpha:1.0];

  RCTStopTimer(drawTimer);

  if (_pendingRedraw) {
    _pendingRedraw = NO;

    // Avoid calling `setNeedsDisplay` from inside `drawRect`.
    dispatch_async(dispatch_get_main_queue(), ^{
      RCTStopTimer(_redrawTimer);
      NSLog(@"Redrawing shadow immediately...");
      [self redrawShadowBitmap];
    });
  }
}

- (UIImage *)shadowBitmapFromImage:(UIImage *)textBitmap
                        blurRadius:(CGFloat)blurRadius
{
  RCTAssertNotMainQueue();

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

  CIImage *image = [CIImage imageWithCGImage:textBitmap.CGImage];
  [_blurFilter setValue:image forKey:kCIInputImageKey];
  image = [_blurFilter valueForKey:kCIOutputImageKey];
  return [UIImage imageWithCIImage:image];
}

@end
