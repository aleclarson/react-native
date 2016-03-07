#!/bin/bash

projectDir=$(pwd)

function cleanup {
  cd $projectDir
}
trap cleanup EXIT

cd $LOTUS_PATH/react-native/packager
./packager.sh $@ --projectRoots $projectDir
