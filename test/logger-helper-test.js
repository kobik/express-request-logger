'use strict';

var httpMocks = require('node-mocks-http'),
    loggerHelper = require('../lib/logger-helper'),
    should = require('should'),
    _ = require('lodash'),
    utils = require('../lib/utils'),
    sinon = require('sinon');

var NA = 'N/A';
var MASK = 'XXXXX';
var method = 'POST';
var url = 'somepath/123';
var startTime = new Date();
var endTime = new Date();
var elapsed = endTime - startTime;
var body = {
    body: 'body'
};

var query = {
    q1: 'something',
    q2: 'fishy'
}

describe('logger-helpers tests', function(){
    var sandbox, clock, loggerInfoStub, shouldAuditURLStub;
    var request, response, options;

    var expectedAuditRequest = {
        method: method,
        url: url,
        query: query,
        headers: {
            header1: 'some-value'
        },
        timestamp: startTime.toISOString(),
        timestamp_ms: startTime.valueOf(),
        body: JSON.stringify(body),
    };
    var expectedAuditResponse = {
        status_code: 200,
        timestamp: endTime.toISOString(),
        timestamp_ms: endTime.valueOf(),
        elapsed: elapsed,
        body: JSON.stringify(body)
    };
    before(function(){
        sandbox = sinon.sandbox.create();
        clock = sinon.useFakeTimers();
        shouldAuditURLStub = sandbox.stub(utils, 'shouldAuditURL');
    });
    after(function(){
        sandbox.restore();
        clock.restore();
    });
    describe('When calling auditRequest', function(){
        beforeEach(function(){
            request = httpMocks.createRequest({
                method: method,
                url: url,
                query: query,
                body: body,
                headers: {
                    header1: 'some-value'
                }
            });

            request.timestamp = startTime;
            response = httpMocks.createResponse();
            response._body = JSON.stringify(body);
            response.timestamp = endTime;
            options = {
                request: {
                    audit: true
                },
                response: {
                    audit: true
                },
                logger: {}
            };
            options.logger.info = function(){};

            loggerInfoStub = sandbox.stub(options.logger, 'info');
        });
        afterEach(function(){
            utils.shouldAuditURL.reset();
        });
        describe('And shouldAuditURL returns false', function(){
            it('Should not audit request', function(){
                shouldAuditURLStub.returns(false);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.called).eql(false);
            });
        });
        describe('And shouldAuditURL returns true', function(){
            it('Should audit request if options.request.audit is true', function(){
                shouldAuditURLStub.returns(true);
                options.request.audit = true;
                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);
                //should(loggerInfoStub.calledWith({ request: undefined })).eql(true);
            });
            it('Should not audit request if options.request.audit is false', function(){
                shouldAuditURLStub.returns(true);
                options.request.audit = false;
                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({ request: undefined })).eql(true);
            });
        });
        describe('And additionalAudit is not empty', function(){
            beforeEach(function(){
                request.additionalAudit = {
                    field1: 'field1',
                    field2: 'field2'
                };
            });
            afterEach(function(){
                delete request.additionalAudit;
                delete expectedAuditRequest.field1;
                delete expectedAuditRequest.field2;
            });
            it('Should add to audit the additional audit details', function(){
                shouldAuditURLStub.returns(true);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({ request: expectedAuditRequest, field1: 'field1', field2: 'field2' })).eql(true);
            });

            it('Should not add to audit the additional audit details if its an empty object', function(){
                request.additionalAudit = {};
                delete expectedAuditRequest.field1;
                delete expectedAuditRequest.field2;

                shouldAuditURLStub.returns(true);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({ request: expectedAuditRequest })).eql(true);
            });
        });
        describe('And mask query params that are set to be masked', function(){
            it('Should mask the query param', function(){
                var maskedQuery = 'q1'
                options.request.maskQuery = [maskedQuery];
                shouldAuditURLStub.returns(true);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);

                let expected = _.cloneDeep(expectedAuditRequest)
                expected.query[maskedQuery] = MASK;
                should(loggerInfoStub.args[0]).eql([{ request: expected }]);

                // Clear created header for other tests
            });
            it('Should mask all query params', function(){
                var maskedQuery1 = 'q1'
                var maskedQuery2 = 'q2'
                options.request.maskQuery = [maskedQuery1, maskedQuery2];
                shouldAuditURLStub.returns(true);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);

                let expected = _.cloneDeep(expectedAuditRequest)
                expected.query[maskedQuery1] = MASK;
                expected.query[maskedQuery2] = MASK;
                should(loggerInfoStub.args[0]).eql([{ request: expected }]);
            });
        })
        describe('And exclude headers contains an header to exclude', function(){
            var headerToExclude = 'header-to-exclude';
            beforeEach(function(){
                request.headers[headerToExclude] = 'other-value';
            });
            it('Should audit log without the specified header', function(){
                options.request.excludeHeaders = [headerToExclude];
                shouldAuditURLStub.returns(true);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({ request: expectedAuditRequest })).eql(true);
            });
            it('Should audit log without the specified headers, if there are moer than one', function(){
                var anotherHeaderToExclude = 'another';
                options.request.excludeHeaders = [headerToExclude, anotherHeaderToExclude];
                request.headers[anotherHeaderToExclude] = 'some value';
                shouldAuditURLStub.returns(true);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({ request: expectedAuditRequest })).eql(true);
            });
            it('Should audit log with all headers, if exclude headers is an empty list', function(){
                options.request.excludeHeaders = ['other-header'];
                shouldAuditURLStub.returns(true);

                loggerHelper.auditRequest(request, options);
                should(loggerInfoStub.calledOnce).eql(true);

                expectedAuditRequest.headers[headerToExclude] = 'other-value';
                should(loggerInfoStub.calledWith({ request: expectedAuditRequest })).eql(true);

                // Clear created header for other tests
                delete expectedAuditRequest.headers[headerToExclude];
            });
        });
    });

    describe('When calling auditResponse', function(){
        beforeEach(function(){
            request = httpMocks.createRequest({
                method: method,
                url: url,
                query: query,
                body: body,
                headers: {
                    header1: 'some-value'
                }
            });

            request.timestamp = startTime;
            response = httpMocks.createResponse();
            response._body = JSON.stringify(body);
            response.timestamp = endTime;
            options = {
                request: {
                    audit: true
                },
                response: {
                    audit: true
                },
                logger: {}
            };
            options.logger.info = function(){};

            loggerInfoStub = sandbox.stub(options.logger, 'info');

        });
        afterEach(function(){
            utils.shouldAuditURL.reset();
        });
        describe('And shouldAuditURL returns false', function(){
            it('Should not audit request/response', function(){
                shouldAuditURLStub.returns(false);

                loggerHelper.auditResponse(request, response, options);
                should(loggerInfoStub.called).eql(false);
            });
        });
        describe('And shouldAuditURL returns true', function(){
            it('Should audit request if options.request.audit is true', function(){
                shouldAuditURLStub.returns(true);
                options.request.audit = true;
                clock.tick(elapsed);
                loggerHelper.auditResponse(request, response, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({
                    request: expectedAuditRequest,
                    response: expectedAuditResponse
                })).eql(true);
            });
            it('Should not audit request if options.request.audit is false', function(){
                shouldAuditURLStub.returns(true);
                options.request.audit = false;
                clock.tick(elapsed);
                loggerHelper.auditResponse(request, response, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({
                    request: undefined,
                    response: expectedAuditResponse
                })).eql(true);
            });
            it('Should audit response if options.response.audit is true', function(){
                shouldAuditURLStub.returns(true);
                options.response.audit = true;
                clock.tick(elapsed);
                loggerHelper.auditResponse(request, response, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({
                    request: expectedAuditRequest,
                    response: expectedAuditResponse
                })).eql(true);
            });
            it('Should not audit response if options.response.audit is false', function(){
                shouldAuditURLStub.returns(true);
                options.response.audit = false;
                clock.tick(elapsed);
                loggerHelper.auditResponse(request, response, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({
                    request: expectedAuditRequest,
                    response: undefined
                })).eql(true);
            });
            it('Should log empty values as N/A', function(){
                request = undefined;
                response = undefined;

                shouldAuditURLStub.returns(true);
                clock.tick(elapsed);
                loggerHelper.auditResponse(request, response, options);
                should(loggerInfoStub.calledOnce).eql(true);
                should(loggerInfoStub.calledWith({
                    request: {
                        method: NA,
                        url: NA,
                        query: NA,
                        headers: NA,
                        timestamp: NA,
                        timestamp_ms: NA,
                        body: NA
                    },
                    response: {
                        status_code: NA,
                        timestamp: NA,
                        timestamp_ms: NA,
                        elapsed: 0,
                        body: NA
                    }
                })).eql(true);
            });
        });
    });
});