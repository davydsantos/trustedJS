function SignedData() {
    var obj, cache;
    this.__proto__ = {
        get version() {
            if (obj === undefined) {
                return 1;
            }
            else {
                return obj.version;
            }
        },
        get digestAlgorithms() {
            if (cache.algs === undefined) {
                cache.algs = [];
                if (obj !== undefined)
                    var algs = {};
                for (var i = 0; i < obj.digestAlgorithms.length; i++) {
                    if (!(obj.digestAlgorithms[i].algorithm in algs)) {
                        algs[obj.digestAlgorithms[i].algorithm] = null;
                        cache.algs.push(new trusted.PKI.Algorithm(obj.digestAlgorithms[i]));
                    }
                }
            }
            return cache.algs;
        },
        get certificates() {
            if (cache.certs === undefined) {
                cache.certs = [];
                if (obj !== undefined && obj.certificates !== null)
                    for (var i = 0; i < obj.certificates.length; i++) {
                        if (!("certificate" in obj.certificates[i]))
                            throw "SignedData.certificate: ExtendedCerificate не поддерживается.";
                        cache.certs.push(new trusted.PKI.Certificate(obj.certificates[i].certificate));
                    }
            }
            return cache.certs;
        },
        get signers() {
            if (cache.signers === undefined) {
                cache.signers = [];
                if (obj !== undefined && obj.signers !== null)
                    for (var i = 0; i < obj.signerInfos.length; i++) {
                        var cert = new CertID(
                                new trusted.PKI.Name(obj.signerInfos[i].issuerAndSerialNumber.issuer),
                                obj.signerInfos[i].issuerAndSerialNumber.serialNumber
                                );
                        cache.signers.push(new Signer(obj.signerInfos[i], this.getCertificate(cert)));
                    }
            }
            return cache.signers;
        },
        set content(v) {
            if (!trusted.isString()) {
                "SignedData.content SET: Значение должно быть Строкой.";
            }
            if (cache.content !== v) {
                refreshVars();
                cache.content = v;
            }
        },
        get content() {
            if (cache.content === undefined) {
                cache.content = null;
                try {
                    // if content is array
                    var asn = new trusted.ASN(obj.contentInfo.content);
                    cache.content = asn.toObject("SignedDataContent").join("");
                }
                catch (e) {
                    cache.content = obj.contentInfo.content;
                }
            }
            return cache.content;
        }
    };

    this.__proto__.getHash = function(algorithm, content) {
        if (algorithm === undefined)
            algorithm = {name: "SHA-1"};
        var _this = this;
        var sequence = new Promise(function(resolve, reject) {
            if (!(algorithm.name in trusted.RegisteredAlgorithms.getAlgorithms("digest")))
                reject("SignedData.getHash: Using of Unknown algorithm. " + algorithm.name);
            if (_this.content === null)
                reject("SignedData.getHash: The conetent of Signed Data is null.");

            trusted.Crypto.digest(algorithm, Der.toUint8Array(_this.content)).then(
                    function(digest) {
                        resolve(String.fromCharCode.apply(null, new Uint8Array(digest)));
                    },
                    function(error) {
                        reject("SignedData.getHash: " + error);
                    }
            );
        });
        return sequence;
    };

    this.__proto__.verify = function(content, certs) {
        if (content === undefined)
            content = this.content;
        if (certs === undefined)
            certs = [];
        if (!trusted.isArray(certs))
            certs = [certs];

        var _this = this;

        var sequence = new Promise(function(resolve, reject) {
            // get certificates of Signers
            var signers = [];
            for (var i = 0; i < _this.signers.length; i++) {
                if (_this.signers[i].certificate !== null)
                    signers.push(_this.signers[i]); // get certificates from SignedData
                else
                    for (var j = 0; j < certs.length; j++)
                        if (certs[j].equals(_this.signer[i].certificateID))
                            signers.push(new Signer(obj.signerInfos[i], certs[j])); // get imported certificates
                        else
                            break;
            }
            if (signers.length !== _this.signers.length)
                reject("SignedData.verify: Указаны не все сертификаты подписчиков.");
            //-----

            // verifign signature for each signer
            var result = {status: true, signerInfos: []}; // init SignedData VerifyStatus
            var promises = [];
            for (var i = 0; i < signers.length; i++) {
                var signer = signers[i];
                promises.push(
                        signer.verify(content).then(
                        function(verify) {
                            if (!verify.status) {
                                result.status = false;
                            }
                            result.signerInfos.push(verify);
                        },
                        function(error) {
                            result.signerInfos.push(error);
                            result.status = false;
                        }
                ));
            }
            Promise.all(promises).then(
                    function() {
                        resolve(result);
                    }
            );

        });
        return sequence;
    };

    this.__proto__.getCertificate = function(cert) {
        for (var i = 0; i < this.certificates.length; i++) {
            if (this.certificates[i].compare(cert))
                return this.certificates[i];
        }
    };

    function init(args) {
        refreshVars();
        switch (args.length) {
            case 0:
                break;
            default:
                var v = args[0];
                if (trusted.isString(v)) {
                    try {
                        v = new PKCS7(v);
                    }
                    catch (e) {
                        throw "SignedData.new: ASN пакет не соответствует структуре ASN PKCS7.";
                    }
                    if (v.OID.value !== "1.2.840.113549.1.7.2")
                        throw "SignedData.new: Тип PKCS7 не является SignedData.";
                    var asn = new trusted.ASN(v.content);
                    v = asn.toObject("SignedData");
                }
                obj = v;
                console.log("SignedData:", obj);
        }
    }

    function refreshVars() {
        obj = undefined;
        cache = {};
    }

    init.call(this, arguments);
}