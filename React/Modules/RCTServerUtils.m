
#import "RCTServerUtils.h"
#import "RCTIPAddress.h"

@implementation RCTServerUtils

+ (NSURL *)serverURLForPath:(NSString *)path
{
  NSUserDefaults *standardDefaults = [NSUserDefaults standardUserDefaults];
  NSInteger port = [standardDefaults integerForKey:@"websocket-executor-port"] ?: 8081;
  NSString *url = [NSString stringWithFormat:@"http://%@:%zd/%@", LOCAL_IP_ADDRESS, port, path];
  return [NSURL URLWithString:url];
}

@end
