REPORTER ?= list
SRC = $(shell find index.js lib -name "*.js" -type f | sort)
TESTSRC = $(shell find test -name "*.js" -type f | sort)

default: test

lint: $(SRC) $(TESTSRC)
	@node_modules/.bin/jshint --reporter=node_modules/jshint-stylish $^

test-unit: lint
	@node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--ui bdd \
		test/*-test.js

test-integration: lint
	@node_modules/.bin/mocha \
		--reporter spec \
		--ui bdd \
		test/integration/*-test.js

coverage: lint
	@node_modules/.bin/nyc --reporter=lcov --reporter=text node_modules/mocha/bin/_mocha $(TESTSRC)
	@node_modules/.bin/nyc check-coverage --statements 100 --functions 100 --branches 100 --lines 100

test-io: lint
	@node node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--ui bdd \
		--grep "stream data after handling retryable error" \
		test/*-test.js

test: test-unit test-integration

.PHONY: test test-cov test-cov-html
