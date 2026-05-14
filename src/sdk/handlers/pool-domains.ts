import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";
import { DataStore } from "../../data/store";
import { UserPoolDomain } from "../../types";

let store: DataStore<UserPoolDomain> | undefined;
function getStore(ctx: AppContext): DataStore<UserPoolDomain> {
  if (!store) {
    store = new DataStore<UserPoolDomain>(
      ctx.config.dataDir,
      "user-pool-domains.json"
    );
  }
  return store;
}

export function createUserPoolDomainHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { Domain, UserPoolId, CustomDomainConfig } = req.body;
    if (!Domain || !UserPoolId) {
      throw new InvalidParameterError(
        "Domain and UserPoolId are required."
      );
    }
    getStore(ctx).set(Domain, {
      domain: Domain,
      userPoolId: UserPoolId,
      customDomainConfig: CustomDomainConfig && {
        certificateArn: CustomDomainConfig.CertificateArn,
      },
      status: "ACTIVE",
      version: "20201001",
    });
    res.json({
      CloudFrontDomain: `${Domain}.auth.us-east-1.amazoncognito.com`,
    });
  };
}

export function describeUserPoolDomainHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { Domain } = req.body;
    if (!Domain) throw new InvalidParameterError("Domain is required.");
    const d = getStore(ctx).get(Domain);
    if (!d) {
      res.json({ DomainDescription: {} });
      return;
    }
    res.json({
      DomainDescription: {
        UserPoolId: d.userPoolId,
        AWSAccountId: "000000000000",
        Domain: d.domain,
        S3Bucket: d.s3Bucket,
        CloudFrontDistribution: d.cloudFrontDistribution,
        Version: d.version,
        Status: d.status,
        CustomDomainConfig: d.customDomainConfig && {
          CertificateArn: d.customDomainConfig.certificateArn,
        },
      },
    });
  };
}

export function updateUserPoolDomainHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { Domain, UserPoolId, CustomDomainConfig } = req.body;
    if (!Domain || !UserPoolId) {
      throw new InvalidParameterError(
        "Domain and UserPoolId are required."
      );
    }
    const existing = getStore(ctx).get(Domain);
    if (!existing) {
      throw new ResourceNotFoundError(`Domain ${Domain} not found.`);
    }
    getStore(ctx).set(Domain, {
      ...existing,
      customDomainConfig: CustomDomainConfig && {
        certificateArn: CustomDomainConfig.CertificateArn,
      },
    });
    res.json({
      CloudFrontDomain: `${Domain}.auth.us-east-1.amazoncognito.com`,
    });
  };
}

export function deleteUserPoolDomainHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { Domain } = req.body;
    if (!Domain) throw new InvalidParameterError("Domain is required.");
    getStore(ctx).delete(Domain);
    res.json({});
  };
}
