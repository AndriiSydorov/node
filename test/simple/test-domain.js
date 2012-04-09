// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// Simple tests of most basic domain functionality.

var common = require('../common');
var assert = require('assert');
var domain = require('domain');
var events = require('events');
var caught = 0;
var expectCaught = 7;

var d = new domain.create();
var e = new events.EventEmitter();

d.on('error', function(er) {
  console.error('caught', er);
  switch (er.message) {
    case 'emitted':
      assert.equal(er.domain, d);
      assert.equal(er.domain_emitter, e);
      assert.equal(er.domain_thrown, false);
      break;

    case 'bound':
      assert.ok(!er.domain_emitter);
      assert.equal(er.domain, d);
      assert.equal(er.domain_bound, fn);
      assert.equal(er.domain_thrown, false);
      break;

    case 'thrown':
      assert.ok(!er.domain_emitter);
      assert.equal(er.domain, d);
      assert.equal(er.domain_thrown, true);
      break;

    case "ENOENT, open 'this file does not exist'":
      assert.equal(er.domain, d);
      assert.equal(er.domain_thrown, false);
      assert.equal(typeof er.domain_bound, 'function');
      assert.ok(!er.domain_emitter);
      assert.equal(er.code, 'ENOENT');
      assert.equal(er.path, 'this file does not exist');
      assert.equal(typeof er.errno, 'number');
      break;

    case "ENOENT, open 'stream for nonexistent file'":
      assert.equal(typeof er.errno, 'number');
      assert.equal(er.code, 'ENOENT');
      assert.equal(er.path, 'stream for nonexistent file');
      assert.equal(er.domain, d);
      assert.equal(er.domain_emitter, fst);
      assert.ok(!er.domain_bound);
      assert.equal(er.domain_thrown, false);
      break;

    case 'implicit':
      assert.equal(er.domain_emitter, implicit);
      assert.equal(er.domain, d);
      assert.equal(er.domain_thrown, false);
      assert.ok(!er.domain_bound);
      break;

    case 'implicit timer':
      assert.equal(er.domain, d);
      assert.equal(er.domain_thrown, true);
      assert.ok(!er.domain_emitter);
      assert.ok(!er.domain_bound);
      break;

    default:
      console.error('unexpected error, throwing %j', er.message);
      throw er;
  }

  caught++;
});

process.on('exit', function() {
  console.error('exit');
  assert.equal(caught, expectCaught);
  console.log('ok');
});



// Event emitters added to the domain have their errors routed.
d.add(e);
e.emit('error', new Error('emitted'));



// get rid of the `if (er) return cb(er)` malarky, by intercepting
// the cb functions to the domain, and using the intercepted function
// as a callback instead.
function fn(er) {
  throw new Error('This function should never be called!');
  process.exit(1);
}

var bound = d.intercept(fn);
bound(new Error('bound'));



// throwing in a bound fn is also caught,
// even if it's asynchronous, by hitting the
// global uncaughtException handler. This doesn't
// require interception, since throws are always
// caught by the domain.
function thrower() {
  throw new Error('thrown');
}
setTimeout(d.bind(thrower), 100);



// Pass a bound function to an fs operation that fails.
var fs = require('fs');
fs.readFile('this file does not exist', d.bind(function(er) {
  console.error('should not get here!', er);
  throw new Error('should not get here!');
}));



// implicit addition by being created within a domain-bound context.
var implicit;

d.run(function() {
  implicit = new events.EventEmitter;
});

setTimeout(function() {
  // escape from the domain, but implicit is still bound to it.
  implicit.emit('error', new Error('implicit'));
}, 10);



// implicit addition of a timer created within a domain-bound context.
d.run(function() {
  setTimeout(function() {
    throw new Error('implicit timer');
  });
});



var fst = fs.createReadStream('stream for nonexistent file')
d.add(fst)
