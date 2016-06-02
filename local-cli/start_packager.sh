
# if nc -w 5 -z $IP_ADDR 8081 ; then
#   if ! curl -s "http://$IP_ADDR:8081/status" | grep -q "packager-status:running" ; then
#     echo "Port 8081 already in use, packager is either not running or not running correctly"
#     exit 2
#   fi
# else
#   open "$SRCROOT/../packager/launchPackager.command" || echo "Can't start packager automatically"
# fi
