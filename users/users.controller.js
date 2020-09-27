const express = require("express");
const router = express.Router();
const userService = require("./user.service");
const logService = require("../logs/log.service");
const config = require("config.js");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

// routes
router.post("/authenticate", authenticate);
router.post("/register", register);
router.get("/", getAll);
router.get("/current", getCurrent);
router.get("/audit", getAudit);
router.get("/logout", logout);
router.get("/:id", getById);
router.put("/:id", update);
router.delete("/:id", _delete);

module.exports = router;

function authenticate(req, res, next) {
  userService
    .authenticate(req.body)
    .then((user) => {
      if (user) {
        let logParam = {
          user: user._id,
          loginDateTime: new Date(),
          ipAddress:
            req.headers["x-forwarded-for"] || req.connection.remoteAddress,
        };

        // create log
        logService
          .create(logParam)
          .then((log) => {
            console.log("log created");
          })
          .catch((err) => next(err));
        res.json(user);
      } else {
        res.status(400).json({ message: "Username or password is incorrect" });
      }
    })
    .catch((err) => next(err));
}

function logout(req, res, next) {
  const userId = getUserIdByReqHeaderToken(req);

  // get last log
  logService
    .getLog({ user: userId }, -1, 1)
    .then((lastLog) => {
      // if log exist
      if (lastLog) {
        let userParams = {
          logoutDateTime: new Date(),
        };
        logService
          .update(lastLog._id, userParams)
          .then(() => res.json({}))
          .catch((err) => next(err));
      } else {
        res.sendStatus(404);
      }
    })
    .catch((err) => next(err));
}

function register(req, res, next) {
  userService
    .create(req.body)
    .then(() => res.json({}))
    .catch((err) => next(err));
}

function getAll(req, res, next) {
  userService
    .getAll(Number(req.query.limit) || 10, Number(req.query.skip) || 0)
    .then((data) => res.json(data))
    .catch((err) => next(err));
}

function getCurrent(req, res, next) {
  userService
    .getById(req.user.sub)
    .then((user) => (user ? res.json(user) : res.sendStatus(404)))
    .catch((err) => next(err));
}

async function getAudit(req, res, next) {
  const userId = getUserIdByReqHeaderToken(req);

  const user = await userService.getUser({
    _id: new ObjectId(userId),
    role: "Auditor",
  });

  if (user) {
    logService
      .getLogs(
        { user: new ObjectId(userId) },
        -1,
        Number(req.query.limit) || 10,
        Number(req.query.skip) || 0
      )
      .then((logs) => res.json(logs))
      .catch((err) => next(err));
  } else {
    res.sendStatus(401);
  }
}

function getById(req, res, next) {
  userService
    .getById(req.params.id)
    .then((user) => (user ? res.json(user) : res.sendStatus(404)))
    .catch((err) => next(err));
}

function update(req, res, next) {
  userService
    .update(req.params.id, req.body)
    .then(() => res.json({}))
    .catch((err) => next(err));
}

function _delete(req, res, next) {
  userService
    .delete(req.params.id)
    .then(() => res.json({}))
    .catch((err) => next(err));
}

function getUserIdByReqHeaderToken(req) {
  let token = req.headers.authorization.replace(/ +(?= )/g, "").split(" ")[1];
  let userId;
  // Jwt verify
  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      res.status(400).json({ message: "Invalid data" });
    }

    userId = decoded.sub;
  });

  return userId;
}
