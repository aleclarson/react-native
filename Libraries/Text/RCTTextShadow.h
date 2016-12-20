//
//  RCTTextShadow.h
//  RCTText
//
//  Created by Alec Stanford Larson on 12/20/16.
//  Copyright © 2016 Facebook. All rights reserved.
//

#import <UIKit/UIKit.h>

@interface RCTTextShadow : UIView

- (instancetype)initWithOptions:(NSDictionary *)options;
- (void)updateWithOptions:(NSDictionary *)options;

- (CGRect)textFrame;
- (UIImage *)textBitmap;
- (void)setTextFrame:(CGRect)textFrame textBitmap:(UIImage *)textBitmap;

@property (nonatomic, assign) CGSize offset;
@property (nonatomic, strong) UIColor *color;
@property (nonatomic, strong) NSNumber *radius;
@property (nonatomic, strong) NSNumber *opacity;

@end
