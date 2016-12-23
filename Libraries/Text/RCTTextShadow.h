//
//  RCTTextShadow.h
//  RCTText
//
//  Created by Alec Stanford Larson on 12/20/16.
//  Copyright © 2016 Facebook. All rights reserved.
//

#import <GLKit/GLKit.h>

@interface RCTTextShadow : GLKView

- (instancetype)initWithOptions:(NSDictionary *)options;
- (void)updateWithOptions:(NSDictionary *)options;

// An image of rasterized text is used to generate the text shadow.
@property (nonatomic, strong) UIImage *textBitmap;

@end
