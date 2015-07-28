var R = require('ramda');

// `f` is a function that takes two function arguments: `reject` (failure) and `resolve` (success)
function Future(f) {
  if (!(this instanceof Future)) {
    return new Future(f);
  }
  this._fork = f;
}

function fork(reject, resolve) {
  try {
    this._fork(reject, resolve);
  } catch(e) {
    reject(e);
  }
}

Future.prototype.fork = fork;

// functor
Future.prototype.map = function(f) {
  return this.chain(function(a) {
    return Future.of(f(a));
  });
};

// apply
Future.prototype.ap = function(m) {
  var future = this;

  return new Future(function(rej, res) {
    var applyFn, val;
    var doReject = R.once(rej);

    function resolveIfDone() {
      if (applyFn != null && val != null) {
        return res(applyFn(val));
      }
    }

    future.fork(doReject, function(fn) {
      applyFn = fn;
      resolveIfDone();
    });

    m.fork(doReject, function(v) {
      val = v;
      resolveIfDone();
    });

  });

};

// applicative
Future.of = function(x) {
  // should include a default rejection?
  return new Future(of(x));
};

function of(x) {
  return function(_, resolve) {
    return resolve(x);
  };
}

Future.prototype.of = Future.of;

// chain
//  f must be a function which returns a value
//  f must return a value of the same Chain
//  chain must return a value of the same Chain
//:: Future a, b => (b -> Future c) -> Future c
Future.prototype.chain = function(f) {  // Sorella's:
  var future = this;
  return new Future(function(reject, resolve) {
    return future.fork(function(a) { return reject(a); },
                       function(b) { return f(b).fork(reject, resolve); });
  });
};

// chainReject
// Like chain but operates on the reject instead of the resolve case.
//:: Future a, b => (a -> Future c) -> Future c
Future.prototype.chainReject = function(f) {
  return new Future(function(reject, resolve) {
    return this.fork(function(a) { return f(a).fork(reject, resolve); },
                     function(b) { return resolve(b);
    });
  }.bind(this));
};

// monad
// A value that implements the Monad specification must also implement the Applicative and Chain specifications.
// see above.

Future.prototype.bimap = function(errFn, successFn) {
  var future = this;
  return new Future(function(reject, resolve) {
    future.fork(function(err) {
      reject(errFn(err));
    }, function(val) {
      resolve(successFn(val));
    });
  });
};

Future.reject = function(val) {
  return new Future(function(reject) {
    reject(val);
  });
};

Future.prototype.toString = function() {
  return 'Future(' + R.toString(this._fork) + ')';
};

module.exports = Future;


Future.T = function(M) {

  function FutureT(fork) {
    if (!(this instanceof FutureT)) {
      return new FutureT(fork);
    }
    this._fork = fork;
  }

  FutureT.prototype.fork = fork;

  FutureT.prototype.lift =
  FutureT.lift = R.compose(FutureT, of);

  FutureT.prototype.of =
  FutureT.of = R.compose(FutureT.lift, M.of);

  FutureT.prototype.chain = function(f) {
    var futureT = this;
    return new FutureT(function(reject, resolve) {
      return futureT.fork(reject, function(v) {
        var v2 = v.chain(f);
        if(v2 instanceof M) {
          resolve(v2);
        } else {
          v2.fork(reject, resolve);
        }
      });
    });
  };

  FutureT.prototype.map = function(f) {
    return this.chain(R.compose(FutureT.of, f));
  };

  FutureT.prototype.ap = function(m) {
    var futureT = this;

    return new FutureT(function(rej, res) {
      var applyM, valM;
      var doReject = R.once(rej);

      function resolveIfDone() {
        if (applyM != null && valM != null) {
          return res(applyM.ap(valM));
        }
      }

      futureT.fork(doReject, function(m) {
        applyM = m;
        resolveIfDone();
      });

      m.fork(doReject, function(m) {
        valM = m;
        resolveIfDone();
      });

    });

  };

  FutureT.prototype.toString = function() {
    return 'FutureT(' + R.toString(this._fork) + ')';
  };

  return FutureT;
};
