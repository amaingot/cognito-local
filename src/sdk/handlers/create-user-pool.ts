import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../index";
import { invalidParameterError } from "../errors";

export function createUserPoolHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { PoolName, Schema, UsernameAttributes } = req.body;

    if (!PoolName) {
      invalidParameterError(res, "PoolName is required.");
      return;
    }

    const poolId = `${ctx.config.region}_${uuidv4().replace(/-/g, "").substring(0, 9)}`;
    const now = new Date().toISOString();

    const schema = Schema
      ? Schema.map(
          (s: {
            Name: string;
            AttributeDataType?: string;
            Required?: boolean;
            Mutable?: boolean;
          }) => ({
            name: s.Name,
            attributeDataType: s.AttributeDataType || "String",
            required: s.Required ?? false,
            mutable: s.Mutable ?? true,
          })
        )
      : [
          {
            name: "email",
            attributeDataType: "String",
            required: true,
            mutable: true,
          },
        ];

    const pool = {
      id: poolId,
      name: PoolName,
      region: ctx.config.region,
      usernameAttributes: UsernameAttributes || ["email"],
      schema,
      createdAt: now,
      updatedAt: now,
    };

    ctx.userPoolStore.createPool(pool);

    res.json({
      UserPool: {
        Id: pool.id,
        Name: pool.name,
        Status: "Enabled",
        LastModifiedDate: pool.updatedAt,
        CreationDate: pool.createdAt,
        SchemaAttributes: pool.schema.map(
          (s: {
            name: string;
            attributeDataType: string;
            required: boolean;
            mutable: boolean;
          }) => ({
            Name: s.name,
            AttributeDataType: s.attributeDataType,
            Required: s.required,
            Mutable: s.mutable,
          })
        ),
        UsernameAttributes: pool.usernameAttributes,
      },
    });
  };
}
