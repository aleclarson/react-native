/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTSpringAnimation.h"

#import <UIKit/UIKit.h>

#import "RCTConvert.h"
#import "RCTAnimationUtils.h"
#import "RCTDefines.h"
#import "RCTValueAnimatedNode.h"

@interface RCTSpringAnimation ()

@property (nonatomic, strong) NSNumber *animationId;
@property (nonatomic, strong) RCTValueAnimatedNode *valueNode;
@property (nonatomic, assign) BOOL animationHasBegun;
@property (nonatomic, assign) BOOL animationHasFinished;

@end

@implementation RCTSpringAnimation
{
  CGFloat _toValue;
  CGFloat _fromValue;
  BOOL _isClamped;
  CGFloat _restDistance;
  CGFloat _restVelocity;
  CGFloat _tension;
  CGFloat _friction;
  CGFloat _startVelocity;
  NSTimeInterval _animationStartTime;
  NSTimeInterval _animationCurrentTime;
  RCTResponseSenderBlock _callback;

  CGFloat _lastPosition;
  CGFloat _lastVelocity;
}

- (instancetype)initWithId:(NSNumber *)animationId
                    config:(NSDictionary *)config
                   forNode:(RCTValueAnimatedNode *)valueNode
                  callBack:(nullable RCTResponseSenderBlock)callback
{
  if ((self = [super init])) {
    _animationId = animationId;
    _toValue = [RCTConvert CGFloat:config[@"toValue"]];
    _fromValue = valueNode.value;
    _valueNode = valueNode;
    _isClamped = [RCTConvert BOOL:config[@"clamp"]];
    _restDistance = [RCTConvert CGFloat:config[@"restDistance"]];
    _restVelocity = [RCTConvert CGFloat:config[@"restVelocity"]];
    _tension = [RCTConvert CGFloat:config[@"tension"]];
    _friction = [RCTConvert CGFloat:config[@"friction"]];
    _startVelocity = [RCTConvert CGFloat:config[@"startVelocity"]];
    _callback = [callback copy];

    _lastPosition = _fromValue;
    _lastVelocity = _startVelocity;
  }
  return self;
}

RCT_NOT_IMPLEMENTED(- (instancetype)init)

- (void)startAnimation
{
  _valueNode.animationId = _animationId;
  _animationStartTime = CACurrentMediaTime();
  _animationCurrentTime = _animationStartTime;
  _animationHasBegun = YES;
}

- (void)stopAnimation
{
  _animationHasFinished = YES;
  _valueNode.animationId = nil;
}

- (void)removeAnimation
{
  [self stopAnimation];
  _valueNode = nil;
  if (_callback) {
    _callback(@[@{
      @"finished": @(_animationHasFinished)
    }]);
  }
}

- (void)stepAnimation
{
  if (!_animationHasBegun || _animationHasFinished) {
    // Animation has not begun or animation has already finished.
    return;
  }

  // We are using a fixed time step and a maximum number of iterations.
  // The following post provides a lot of thoughts into how to build this
  // loop: http://gafferongames.com/game-physics/fix-your-timestep/
  CGFloat TIMESTEP_MSEC = 1;
  // Velocity is based on seconds instead of milliseconds
  CGFloat step = TIMESTEP_MSEC / 1000;

  NSTimeInterval currentTime = CACurrentMediaTime();
  NSInteger numSteps = floorf((currentTime - _animationCurrentTime) / step);
  _animationCurrentTime = currentTime;
  if (numSteps == 0) {
    return;
  }

  CGFloat position = _lastPosition;
  CGFloat velocity = _lastVelocity;

  CGFloat tempPosition = _lastPosition;
  CGFloat tempVelocity = _lastVelocity;

  for (NSInteger i = 0; i < numSteps; ++i) {
    // This is using RK4. A good blog post to understand how it works:
    // http://gafferongames.com/game-physics/integration-basics/
    CGFloat aVelocity = velocity;
    CGFloat aAcceleration = _tension * (_toValue - tempPosition) - _friction * tempVelocity;
    tempPosition = position + aVelocity * step / 2;
    tempVelocity = velocity + aAcceleration * step / 2;

    CGFloat bVelocity = tempVelocity;
    CGFloat bAcceleration = _tension * (_toValue - tempPosition) - _friction * tempVelocity;
    tempPosition = position + bVelocity * step / 2;
    tempVelocity = velocity + bAcceleration * step / 2;

    CGFloat cVelocity = tempVelocity;
    CGFloat cAcceleration = _tension * (_toValue - tempPosition) - _friction * tempVelocity;
    tempPosition = position + cVelocity * step / 2;
    tempVelocity = velocity + cAcceleration * step / 2;

    CGFloat dVelocity = tempVelocity;
    CGFloat dAcceleration = _tension * (_toValue - tempPosition) - _friction * tempVelocity;
    tempPosition = position + cVelocity * step / 2;
    tempVelocity = velocity + cAcceleration * step / 2;

    CGFloat dxdt = (aVelocity + 2 * (bVelocity + cVelocity) + dVelocity) / 6;
    CGFloat dvdt = (aAcceleration + 2 * (bAcceleration + cAcceleration) + dAcceleration) / 6;

    position += dxdt * step;
    velocity += dvdt * step;
  }

  _lastPosition = position;
  _lastVelocity = velocity;

  [self onUpdate:position];

  if (self.shouldFinish) {
    if (_tension != 0) {
      // Ensure that we end up with a round value
      [self onUpdate:_toValue];
    }

    [self stopAnimation];
  }
}

- (BOOL)shouldClamp:(CGFloat)position
{
  if (_isClamped && _tension != 0) {
    if (_fromValue < _toValue) {
      return position > _toValue;
    } else {
      return position < _toValue;
    }
  }
  return NO;
}

- (BOOL)shouldFinish
{
  if (_animationHasFinished) {
    return NO;
  }

  if ([self shouldClamp:_lastPosition]) {
    return YES;
  }

  if (ABS(_lastVelocity) <= _restVelocity) {
    if (_tension != 0) {
      return ABS(_toValue - _lastPosition) <= _restDistance;
    } else {
      return YES;
    }
  }

  return NO;
}

- (void)onUpdate:(CGFloat)outputValue
{
  _valueNode.value = outputValue;
  [_valueNode setNeedsUpdate];
}

- (void)cleanupAnimationUpdate
{
  [_valueNode cleanupAnimationUpdate];
}

@end
