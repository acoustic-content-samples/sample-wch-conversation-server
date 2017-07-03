'use strict';

const OFF = 0;
const WARNING = 1;
const ERROR = 2;

module.exports = {
  "env": {
    "node": true,
    "es6": true,
    "mocha": true
  },

  plugins: [],

  "rules": {
    ////////// Possible Errors //////////

    "no-comma-dangle": OFF,         // disallow trailing commas in object literals
    "no-cond-assign": OFF,          // disallow assignment in conditional expressions
    "no-console": OFF,              // disallow use of console (off by default in the node environment)
    "no-constant-condition": OFF,   // disallow use of constant expressions in conditions
    "no-control-regex": OFF,        // disallow control characters in regular expressions
    "no-debugger": OFF,             // disallow use of debugger
    "no-dupe-keys": OFF,            // disallow duplicate keys when creating object literals
    "no-empty": OFF,                // disallow empty statements
    "no-empty-class": OFF,          // disallow the use of empty character classes in regular expressions
    "no-ex-assign": OFF,            // disallow assigning to the exception in a catch block
    "no-extra-boolean-cast": OFF,   // disallow double-negation boolean casts in a boolean context
    "no-extra-parens": OFF,         // disallow unnecessary parentheses (off by default)
    "no-extra-semi": OFF,           // disallow unnecessary semicolons
    "no-func-assign": OFF,          // disallow overwriting functions written as function declarations
    "no-inner-declarations": OFF,   // disallow function or variable declarations in nested blocks
    "no-invalid-regexp": OFF,       // disallow invalid regular expression strings in the RegExp constructor
    "no-irregular-whitespace": ERROR, // disallow irregular whitespace outside of strings and comments
    "no-negated-in-lhs": OFF,       // disallow negation of the left operand of an in expression
    "no-obj-calls": OFF,            // disallow the use of object properties of the global object (Math and JSON) as functions
    "no-regex-spaces": OFF,         // disallow multiple spaces in a regular expression literal
    "no-reserved-keys": OFF,        // disallow reserved words being used as object literal keys (off by default)
    "no-sparse-arrays": OFF,        // disallow sparse arrays
    "no-unreachable": OFF,          // disallow unreachable statements after a return, throw, continue, or break statement
    "use-isnan": OFF,               // disallow comparisons with the value NaN
    "valid-jsdoc": OFF,             // Ensure JSDoc comments are valid (off by default)
    "valid-typeof": OFF,            // Ensure that the results of typeof are compared against a valid string


    ////////// Best Practices //////////

    "block-scoped-var": OFF,      // treat var statements as if they were block scoped (off by default)
    "complexity": ERROR,          // specify the maximum cyclomatic complexity allowed in a program (off by default)
    "consistent-return": OFF,     // require return statements to either always or never specify values
    "curly": ERROR,                 // specify curly brace conventions for all control statements
    "default-case": OFF,          // require default case in switch statements (off by default)
    "dot-notation": ERROR,          // encourages use of dot notation whenever possible
    "dot-location": [ERROR, "property"],          // encourages use of dot notation whenever possible
    "eqeqeq": ERROR,              // require the use of === and !==
    "guard-for-in": OFF,          // make sure for-in loops have an if statement (off by default)
    "no-alert": OFF,              // disallow the use of alert, confirm, and prompt
    "no-caller": OFF,             // disallow use of arguments.caller or arguments.callee
    "no-div-regex": OFF,          // disallow division operators explicitly at beginning of regular expression (off by default)
    "no-else-return": OFF,        // disallow else after a return in an if (off by default)
    "no-empty-label": OFF,        // disallow use of labels for anything other then loops and switches
    "no-eq-null": OFF,            // disallow comparisons to null without a type-checking operator (off by default)
    "no-eval": ERROR,             // disallow use of eval()
    "no-extend-native": OFF,      // disallow adding to native types
    "no-extra-bind": OFF,         // disallow unnecessary function binding
    "no-fallthrough": OFF,        // disallow fallthrough of case statements
    "no-floating-decimal": OFF,   // disallow the use of leading or trailing decimal points in numeric literals (off by default)
    "no-implied-eval": OFF,       // disallow use of eval()-like methods
    "no-iterator": ERROR,         // disallow usage of __iterator__ property
    "no-labels": OFF,             // disallow use of labeled statements
    "no-lone-blocks": OFF,        // disallow unnecessary nested blocks
    "no-loop-func": OFF,          // disallow creation of functions within loops
    "no-multi-spaces": OFF,       // disallow use of multiple spaces
    "no-multi-str": OFF,          // disallow use of multiline strings
    "no-native-reassign": OFF,    // disallow reassignments of native objects
    "no-new": OFF,                // disallow use of new operator when not part of the assignment or comparison
    "no-new-func": OFF,           // disallow use of new operator for Function object
    "no-new-wrappers": OFF,       // disallows creating new instances of String, Number, and Boolean
    "no-octal": OFF,              // disallow use of octal literals
    "no-octal-escape": OFF,       // disallow use of octal escape sequences in string literals, such as var foo = "Copyright \251";
    "no-process-env": OFF,        // disallow use of process.env (off by default)
    "no-proto": OFF,              // disallow usage of __proto__ property
    "no-redeclare": OFF,          // disallow declaring the same variable more then once
    "no-return-assign": OFF,      // disallow use of assignment in return statement
    "no-script-url": OFF,         // disallow use of javascript: urls.
    "no-self-compare": OFF,       // disallow comparisons where both sides are exactly the same (off by default)
    "no-sequences": OFF,          // disallow use of comma operator
    "no-unused-expressions": OFF, // disallow usage of expressions in statement position
    "no-void": OFF,               // disallow use of void operator (off by default)
    "no-warning-comments": OFF,   // disallow usage of configurable warning terms in comments, e.g. TODO or FIXME (off by default)
    "no-with": OFF,               // disallow use of the with statement
    "radix": OFF,                 // require use of the second argument for parseInt() (off by default)
    "vars-on-top": OFF,           // requires to declare all vars on top of their containing scope (off by default)
    "wrap-iife": OFF,             // require immediate function invocation to be wrapped in parentheses (off by default)
    "yoda": OFF,                  // require or disallow Yoda conditions


    ////////// Strict Mode //////////

    "global-strict": OFF,   // (deprecated) require or disallow the "use strict" pragma in the global scope (off by default in the node environment)
    "no-extra-strict": OFF, // (deprecated) disallow unnecessary use of "use strict"; when already in strict mode
    "strict": OFF,          // controls location of Use Strict Directives


    ////////// Variables //////////

    "no-catch-shadow": OFF,             // disallow the catch clause parameter name being the same as a variable in the outer scope (off by default in the node environment)
    "no-delete-var": ERROR,             // disallow deletion of variables
    "no-label-var": OFF,                // disallow labels that share a name with a variable
    "no-shadow": OFF,                   // disallow declaration of variables already declared in the outer scope
    "no-shadow-restricted-names": OFF,  // disallow shadowing of names such as arguments
    "no-undef": OFF,                    // disallow use of undeclared variables unless mentioned in a /*global */ block
    "no-undef-init": OFF,               // disallow use of undefined when initializing variables
    "no-undefined": OFF,                // disallow use of undefined variable (off by default)
    "no-unused-vars": OFF,              // disallow declaration of variables that are not used in the code
    "no-use-before-define": OFF,        // disallow use of variables before they are defined


    ////////// Node.js //////////

    "global-require": ERROR,
    "callback-return": ERROR,
    "handle-callback-err": ERROR,   // enforces error handling in callbacks (off by default) (on by default in the node environment)
    "no-mixed-requires": ERROR,     // disallow mixing regular variable and require declarations (off by default) (on by default in the node environment)
    "no-new-require": ERROR,        // disallow use of new operator with the require function (off by default) (on by default in the node environment)
    "no-path-concat": ERROR,        // disallow string concatenation with __dirname and __filename (off by default) (on by default in the node environment)
    "no-process-exit": ERROR,       // disallow process.exit() (on by default in the node environment)
    "no-restricted-modules": OFF, // restrict usage of specified node modules (off by default)
    "no-sync": ERROR,               // disallow use of synchronous methods (off by default)


    ////////// Stylistic Issues //////////

    "brace-style": [ERROR, 'stroustrup', {'allowSingleLine': true}],               // enforce one true brace style (off by default)
    "camelcase": [ERROR, {'properties': 'always'}],               // require camel case names
    "comma-spacing": ERROR,           // enforce spacing before and after comma
    "comma-style": OFF,               // enforce one true comma style (off by default)
    "consistent-this": [ERROR, '_this'],           // enforces consistent naming when capturing the current execution context (off by default)
    "eol-last": OFF,                  // enforce newline at the end of file, with no multiple empty lines
    "func-names": OFF,                // require function expressions to have a name (off by default)
    "func-style": [ERROR, 'expression'],                // enforces use of function declarations or expressions (off by default)
    "key-spacing": ERROR,             // enforces spacing between keys and values in object literal properties
    "indent": [ERROR, ERROR, {'VariableDeclarator': {'var': 2}, 'SwitchCase': 2}],
    "max-nested-callbacks": OFF,      // specify the maximum depth callbacks can be nested (off by default)
    "new-cap": OFF,                   // require a capital letter for constructors
    "new-parens": OFF,                // disallow the omission of parentheses when invoking a constructor with no arguments
    "no-array-constructor": OFF,      // disallow use of the Array constructor
    "no-inline-comments": OFF,        // disallow comments inline after code (off by default)
    "no-lonely-if": ERROR,             // disallow if as the only statement in an else block (off by default)
    "no-mixed-spaces-and-tabs": OFF,  // disallow mixed spaces and tabs for indentation
    "no-multiple-empty-lines": OFF,   // disallow multiple empty lines (off by default)
    "no-nested-ternary": OFF,         // disallow nested ternary expressions (off by default)
    "no-new-object": OFF,             // disallow use of the Object constructor
    "no-space-before-semi": OFF,      // disallow space before semicolon
    "no-spaced-func": OFF,            // disallow space between function identifier and application
    "no-ternary": OFF,                // disallow the use of ternary operators (off by default)
    "no-trailing-spaces": ERROR,      // disallow trailing whitespace at the end of lines
    "no-underscore-dangle": OFF,      // disallow dangling underscores in identifiers
    "no-wrap-func": OFF,              // disallow wrapping of non-IIFE statements in parens
    "one-var": [ERROR, {'var': 'always', 'let': 'never', 'const': 'never'}],                   // allow just one var statement per function (off by default)
    "operator-assignment": OFF,       // require assignment operator shorthand where possible or prohibit it entirely (off by default)
    "padded-blocks": [ERROR, 'never'],             // enforce padding within blocks (off by default)
    "quote-props": [ERROR, 'consistent'],               // require quotes around object literal property names (off by default)
    "quotes": OFF,                    // specify whether double or single quotes should be used
    "semi": OFF,                      // require or disallow use of semicolons instead of ASI
    "sort-vars": OFF,                 // sort variables within the same declaration block (off by default)
    "space-after-function-name": OFF, // require a space after function names (off by default)
    "space-after-keywords": [ERROR, 'always'],      // require a space after certain keywords (off by default)
    "space-before-blocks": OFF,       // require or disallow space before blocks (off by default)
    "space-in-brackets": OFF,         // require or disallow spaces inside brackets (off by default)
    "space-in-parens": OFF,           // require or disallow spaces inside parentheses (off by default)
    "space-infix-ops": OFF,           // require spaces around operators
    "space-return-throw-case": OFF,   // require a space after return, throw, and case
    "space-unary-ops": [ERROR, {'words': true, 'nonwords': false}],           // Require or disallow spaces before/after unary operators (words on by default, nonwords off by default)
    "spaced-comment": [ERROR, 'always', {'exceptions': ['-', '+', '/', '*'], 'markers': ['=', '!']}],
    "spaced-line-comment": OFF,       // require or disallow a space immediately following the // in a line comment (off by default)
    "wrap-regex": OFF,                // require regex literals to be wrapped in parentheses (off by default)

    ////////// ECMAScript 6 //////////

    "no-var": ERROR,          // require let or const instead of var (off by default)
    "generator-star-spacing": ERROR,  // enforce the position of the * in generator functions (off by default)
    "no-invalid-this": ERROR,

    ////////// Legacy //////////

    "max-depth": [WARNING, 4],       // specify the maximum depth that blocks can be nested (off by default)
    "max-len": OFF,         // specify the maximum length of a line in your program (off by default)
    "max-params": OFF,      // limits the number of parameters that can be used in the function declaration. (off by default)
    "max-statements": OFF,  // specify the maximum number of statement allowed in a function (off by default)
    "no-bitwise": OFF,      // disallow use of bitwise operators (off by default)
    "no-plusplus": OFF      // disallow use of unary operators, ++ and -- (off by default)
  }
};