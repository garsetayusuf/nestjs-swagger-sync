const { Controller, Get, Module } = require('@nestjs/common');

class HelloController {
  getHello() {
    return { message: 'Hello World!' };
  }
}
Controller()(HelloController);
Get('hello')(
  HelloController.prototype,
  'getHello',
  Object.getOwnPropertyDescriptor(HelloController.prototype, 'getHello'),
);

class AppModule {}
Module({ controllers: [HelloController] })(AppModule);
module.exports = { AppModule };
