(function() {

    function CRL() {
        var obj;
        var cache;
        var df_version = 1;

        this.__proto__ = {
            get type() {
                return "CRL";
            },
            get version() {
                if (obj.tbsCertList.version === null)
                    obj.tbsCertList.version = df_version;
                if (obj.tbsCertList.version !== df_version)
                    throw "CRL.version: Версия должна быть раавна 1."
                return obj.tbsCertList.version;
            },
            set version(v) {
            },
            get signatureAlgorithm() {
                if (cache.salg === undefined)
                    cache.salg = new trusted.PKI.Algorithm(obj.tbsCertList.signature);
                return cache.salg;
            },
            set signatureAlgorithm(v) {
            },
            get issuerName() {
                if (cache.issuer === undefined)
                    cache.issuer = new trusted.PKI.Name(obj.tbsCertList.issuer);
                return cache.issuer;
            },
            set issuerName(v) {
            },
            get thisUpdate() {
                return (obj.tbsCertList.thisUpdate.utcTime === undefined)
                        ? obj.tbsCertList.thisUpdate.generalTime
                        : obj.tbsCertList.thisUpdate.utcTime;
            },
            set thisUpdate(v) {
            },
            get nextUpdate() {
                if (obj.tbsCertList.nextUpdate === null || obj.tbsCertList.nextUpdate === undefined)
                    return null;
                return (obj.tbsCertList.nextUpdate.utcTime === undefined)
                        ? obj.tbsCertList.nextUpdate.generalTime
                        : obj.tbsCertList.nextUpdate.utcTime;
            },
            set nextUpdate(v) {
            },
            get certificates() {
                if (cache.certs === undefined) {
                    cache.certs = [];
                    if (obj.tbsCertList.revokedCertificates !== null) {
                        var certs = obj.tbsCertList.revokedCertificates;
                        for (var i = 0; i < certs.length; i++)
                            cache.certs.push(new RevokedCertificate(certs[i]));
                    }
                }
                return cache.certs;
            },
            set certificates(v) {
            },
            get extensions() {
                if (cache.extns === undefined) {
                    cache.extns = [];
                    var extns = obj.tbsCertList.crlExtensions;
                    if (extns !== null) {
                        for (var i = 0; i < extns.length; i++)
                            cache.extns.push(new trusted.PKI.Extension(extns[i]));
                    }
                }
                return cache.extns;
            },
            set signature(v) {
            },
            get signature() {
                return obj.signatureValue;
            },
            set sequenceNumber(v) {
            },
            //return CRLNumber extension value
            get sequenceNumber() {
                if (cache.seqNum === undefined) {
                    cache.seqNum = null;
                    var ext = this.getExtension("2.5.29.20");
                    if (ext !== null)
                        cache.seqNum = (new trusted.PKI.CRLNumber(ext.value)).value;
                }
                return cache.seqNum;
            },
            set deltaNumber(v) {
            },
            //return BaseCRLNumber extension value
            get deltaNumber() {
                if (cache.delNum === undefined) {
                    cache.delNum = null;
                    var ext = this.getExtension("2.5.29.27");
                    if (ext)
                        cache.delNum = (new trusted.PKI.CRLNumber(ext.value)).value;
                }
                return cache.delNum;
            },
            set issuerAlternativeName(v) {
            },
            //return IssuerAlternativeName extension value ONLY  2.5.29.18
            get issuerAlternativeName() {
                if (cache.ian === undefined) {
                    cache.ian = null;
                    var extn = this.getExtension("2.5.29.18");
                    if (extn) {
                        var asn = new trusted.ASN(extn.value);
                        cache.ian = new trusted.PKI.IssuerAlternativeName(asn.toObject("IssuerAlternativeName2"));

                    }
                }
                return cache.ian;
            },
            set TBSCertList(v) {
            },
            get TBSCertList() {
                return cache.tbs;
            }
        };

        this.__proto__.verify = function(key) {
            var err_t = "CRL.verify: ";
            if (key === undefined) {
                return Promise.reject(err_t + "Необходим открытый ключ сертификата издателя.");
            } else {
                switch (key.type) {
                    case "Certificate":
                        key = key.publicKey;
                        break;
                    case "PublicKey":
                        break;
                    default:
                        return Promise.reject(err_t + "Параметр неизвестного типа");
                }
            }

            var verifier = trusted.Crypto.createVerify(this.signatureAlgorithm);
            verifier.update(this.TBSCertList);
            return verifier.verify(key, this.signature.encoded);
        };

        // check if certificate is in CRL list of certificates.
        this.__proto__.hasCertificate = function(cert) {
            var certs = this.certificates;
            // check for extn(2.5.29.28).indirectCRL
            var extn = this.getExtension("2.5.29.28");
            if (extn !== null)
                extn = new trusted.PKI.IssuingDistributionPoint(extn.value);
            var issuerName = null;
            if (extn === null || !extn.indirectCRL)
                issuerName = this.issuerName;
            for (var i = 0; i < certs.length; i++)
                if (cert.compare({
                    issuerName: (issuerName !== null ? issuerName.toString() : certs[i].issuerName.toString()),
                    serialNumber: certs[i].serialNumber
                }))
                    return true;
            return false;
        };

        this.__proto__.getExtension = function(oid) {
            if (!(oid === undefined || this.extensions === null))
                return getExtnByOID(this.extensions, oid); // Возвращает Extension или null
            return null;
        };

        this.__proto__.toObject = function() {
            var o = {};
            o.tbsCertList = {
                version: this.version,
                signature: this.signatureAlgorithm.toObject(),
                issuer: this.issuerName.toObject(),
                thisUpdate: {generalTime: this.thisUpdate}
            };
            void (this.nextUpdate !== null) ? o.tbsCertLis.nextUpdate = {generalTime: this.nextUpdate} : null;
            if (this.certificates !== null) {
                var certs = [];
                for (var i = 0; i < this.certificates.length; i++)
                    certs.push(this.certificates[i].toObject());
                o.tbsCertList.revokedCertificates = certs;
            }
            if (this.extensions !== null) {
                var extns = [];
                for (var i = 0; i < this.extensions.length; i++)
                    extns.push(this.extensions[i].toObject());
                o.tbsCertList.crlExtensions = extns;
            }

            o.signatureAlgorithm = this.signatureAlgorithm.toObject();
            o.signatureValue = this.signature;

            return o;
        };


        // inicialization
        function init(v) {
            if (v === undefined)
                throw "CRL.new: Параметр не может быть Undefined";
            var asn = null;
            cache = {};
            cache.tbs = null;
            if (trusted.isString(v))
                v = new trusted.Buffer(v, "binary");
            asn = new trusted.ASN(v);
            v = asn.toObject("CertificateList");
            cache.tbs = asn.sub[0].blob();
            if (!(trusted.isObject(v) || (true)))
                throw "CRL.new: Задан неверный параметр.";
            obj = v;
        }

        init.call(this, arguments[0]);
    }

    // RevokedCertificate
    function RevokedCertificate() {
        var obj;
        var cache;

        this.__proto__ = {
            get serialNumber() {
                return obj.userCertificate;
            },
            set serialNumber(v) {
            },
            get revocationDate() {
                return (obj.revocationDate.utcTime === undefined)
                        ? obj.revocationDate.generalTime
                        : obj.revocationDate.utcTime;
            },
            set revocationDate(v) {
            },
            get extensions() {
                if (cache.extns === undefined) {
                    cache.extns = [];
                    if (obj.crlEntryExtensions !== null) {
                        for (var i = 0; i < obj.crlEntryExtensions.length; i++)
                            cache.extns.push(new trusted.PKI.Extension(obj.crlEntryExtensions[i]));
                    }
                }
                return cache.extns;
            },
            set extensions(v) {
            },
            set invalidityDate(v) {
            },
            get invalidityDate() {
                if (cache.invd === undefined) {
                    cache.invd = null;
                    var ext = this.getExtension("2.5.29.24");
                    if (ext !== null) {
                        var r = new trusted.PKI.InvalidityDate(ext.value);
                        cache.invd = r.value;
                    }
                }
                return cache.invd;
            },
            set reason(v) {
            },
            get reason() {
                if (cache.reason === undefined) {
                    cache.reason = null;
                    var ext = this.getExtension("2.5.29.21");
                    if (ext !== null) {
                        var r = new trusted.PKI.ReasonCode(ext.value);
                        cache.reason = r.value;
                    }
                }
                return cache.reason;
            },
            set issuerName(v) {
            },
            get issuerName() {
                if (cache.issuer === undefined) {
                    cache.issuer = null;
                    var ext = this.getExtension("2.5.29.29");
                    if (ext !== null) {
                        var r = new trusted.PKI.CertificateIssuer(ext.value);
                        cache.issuer = r;
                    }
                }
                return cache.issuer;
            }
        };

        this.__proto__.getExtension = function(oid) {
            if (!(oid === undefined || this.extensions === null))
                return getExtnByOID(this.extensions, oid); // Возвращает Extension или null
            return null;
        };

        this.__proto__.toObject = function() {
            var o = {};
            o.userCertificate = this.serialNumber;
            o.revocationDate = {generalTime: this.revocationDate};
            if (this.extensions !== null) {
                var extns = [];
                for (var i = 0; i < this.extensions.length; i++)
                    extns.push(this.extensions[i].toObject());
                o.crlEntryExtensions = extns;
            }

            return o;
        };

        // inicialization
        function init(v) {
            if (v === undefined)
                throw "RevokedCertificate.new: Параметр не может быть Undefined";
            v = objFromBuffer(v, "RevokedCertificate");
            if (!(trusted.isObject(v) || ("userCertificate" in v && "revocationDate" in v)))
                throw "RevokedCertificate.new: Задан неверный параметр.";

            obj = v;
            cache = {};
        }

        init.call(this, arguments[0]);
    }

    // export
    trusted.PKI.CRL = CRL;
    trusted.PKI.RevokedCertificate = RevokedCertificate;
})();