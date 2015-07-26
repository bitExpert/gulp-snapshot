declare module 'stream-assert' {
    interface streamAssert {
        nth(n: number, assertion: Function): NodeJS.ReadWriteStream;
        first(assertion: Function): NodeJS.ReadWriteStream;
        second(assertion: Function): NodeJS.ReadWriteStream;
        last(assertion: Function): NodeJS.ReadWriteStream;
        all(assertion: Function): NodeJS.ReadWriteStream;
        length(length: number): NodeJS.ReadWriteStream;
        any(assertion: Function): NodeJS.ReadWriteStream;
        end(cb?: Function): NodeJS.ReadWriteStream;
    }

    var _: streamAssert;
    export = _;
}

declare module 'invert-hash' {
    function invert<A, B>(object: A): B;
    module invert { }
    
    export = invert;
}