/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const chalk = require('chalk');
const events = require('events');

const _eventCache = Object.create(null);
const _eventEmitter = new events.EventEmitter();

let _uuid = 1;
let _enabled = true;

function endEvent(eventId, quiet) {
  const eventEndTime = Date.now();
  if (!_eventCache[eventId]) {
    throw new Error('Event named "' + eventId + '" either ended or never started!');
  }

  _writeAction({
    action: 'endEvent',
    eventId: eventId,
    tstamp: eventEndTime,
    quiet: quiet
  });
}

function startEvent(eventName, data) {
  const eventStartTime = Date.now();

  if (eventName == null) {
    throw new Error('Must provide an "eventName"!');
  }

  if (data == null) {
    data = null;
  }

  const eventId = _uuid++;
  const action = {
    action: 'startEvent',
    data: data,
    eventId: eventId,
    eventName: eventName,
    tstamp: eventStartTime,
  };
  _eventCache[eventId] = action;
  _writeAction(action);

  return eventId;
}

function disable() {
  _enabled = false;
}

function _writeAction(action) {
  _eventEmitter.emit(action.action, action);

  if (!_enabled) {
    return;
  }

  switch (action.action) {
    case 'startEvent':
      log.moat(1);
      log.yellow('[start]  ');
      log.white(action.eventName);
      if (action.data) {
        log.moat(0);
        log.plusIndent(2);
        log.format(action.data, { compact: true });
        log.popIndent();
      }
      log.moat(1);
      break;

    case 'endEvent':
      const startAction = _eventCache[action.eventId];
      if (!action.quiet) {
        log.moat(1);
        log.green('[finish] ');
        log.white(startAction.eventName);
        log.gray.dim(' ', action.tstamp - startAction.tstamp, ' ms');
        if (startAction.data) {
          log.moat(0);
          log.plusIndent(2);
          log.format(startAction.data, { compact: true });
          log.popIndent();
        }
        log.moat(1);
      }
      delete _eventCache[action.eventId];
      break;

    default:
      throw new Error('Unexpected scheduled action type: ' + action.action);
  }
}


exports.endEvent = endEvent;
exports.startEvent = startEvent;
exports.disable = disable;
exports.eventEmitter = _eventEmitter;
