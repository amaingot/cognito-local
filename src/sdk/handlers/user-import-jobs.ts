import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";
import { DataStore } from "../../data/store";
import { UserImportJob } from "../../types";

let store: DataStore<UserImportJob> | undefined;
function getStore(ctx: AppContext): DataStore<UserImportJob> {
  if (!store) {
    store = new DataStore<UserImportJob>(
      ctx.config.dataDir,
      "user-import-jobs.json"
    );
  }
  return store;
}

function toResponse(j: UserImportJob) {
  return {
    UserImportJob: {
      JobName: j.jobName,
      JobId: j.jobId,
      UserPoolId: j.userPoolId,
      PreSignedUrl: j.preSignedUrl,
      CreationDate: j.createdAt,
      StartDate: j.startedAt,
      CompletionDate: j.completedAt,
      Status: j.status,
      ImportedUsers: j.importedUsers,
      SkippedUsers: j.skippedUsers,
      FailedUsers: j.failedUsers,
      CloudWatchLogsRoleArn: j.cloudWatchLogsRoleArn,
    },
  };
}

export function createUserImportJobHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, JobName, CloudWatchLogsRoleArn } = req.body;
    if (!UserPoolId || !JobName) {
      throw new InvalidParameterError(
        "UserPoolId and JobName are required."
      );
    }
    const jobId = `import-${uuidv4()}`;
    const job: UserImportJob = {
      jobId,
      jobName: JobName,
      userPoolId: UserPoolId,
      preSignedUrl: `https://cognito-local.local/imports/${jobId}`,
      cloudWatchLogsRoleArn: CloudWatchLogsRoleArn,
      status: "Created",
      createdAt: ctx.clock.now().toISOString(),
    };
    getStore(ctx).set(jobId, job);
    res.json(toResponse(job));
  };
}

export function describeUserImportJobHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, JobId } = req.body;
    if (!UserPoolId || !JobId) {
      throw new InvalidParameterError(
        "UserPoolId and JobId are required."
      );
    }
    const j = getStore(ctx).get(JobId);
    if (!j) throw new ResourceNotFoundError(`Job ${JobId} not found.`);
    res.json(toResponse(j));
  };
}

export function listUserImportJobsHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, MaxResults, PaginationToken } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const items = getStore(ctx)
      .values()
      .filter((j) => j.userPoolId === UserPoolId);
    const start = PaginationToken ? parseInt(PaginationToken, 10) || 0 : 0;
    const pageSize = MaxResults || 60;
    const page = items.slice(start, start + pageSize);
    const next =
      start + pageSize < items.length ? String(start + pageSize) : undefined;
    res.json({
      UserImportJobs: page.map(
        (j) => ({
          JobName: j.jobName,
          JobId: j.jobId,
          UserPoolId: j.userPoolId,
          PreSignedUrl: j.preSignedUrl,
          CreationDate: j.createdAt,
          StartDate: j.startedAt,
          CompletionDate: j.completedAt,
          Status: j.status,
        })
      ),
      PaginationToken: next,
    });
  };
}

export function startUserImportJobHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { JobId, UserPoolId } = req.body;
    if (!JobId || !UserPoolId) {
      throw new InvalidParameterError("JobId and UserPoolId are required.");
    }
    const j = getStore(ctx).get(JobId);
    if (!j) throw new ResourceNotFoundError(`Job ${JobId} not found.`);
    const updated = {
      ...j,
      status: "InProgress" as const,
      startedAt: ctx.clock.now().toISOString(),
    };
    getStore(ctx).set(JobId, updated);
    res.json(toResponse(updated));
  };
}

export function stopUserImportJobHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { JobId, UserPoolId } = req.body;
    if (!JobId || !UserPoolId) {
      throw new InvalidParameterError("JobId and UserPoolId are required.");
    }
    const j = getStore(ctx).get(JobId);
    if (!j) throw new ResourceNotFoundError(`Job ${JobId} not found.`);
    const updated = {
      ...j,
      status: "Stopped" as const,
      completedAt: ctx.clock.now().toISOString(),
    };
    getStore(ctx).set(JobId, updated);
    res.json(toResponse(updated));
  };
}

export function getCSVHeaderHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) throw new ResourceNotFoundError(`Pool ${UserPoolId} not found.`);
    const headers = [
      "name",
      "given_name",
      "family_name",
      "middle_name",
      "nickname",
      "preferred_username",
      "profile",
      "picture",
      "website",
      "email",
      "email_verified",
      "gender",
      "birthdate",
      "zoneinfo",
      "locale",
      "phone_number",
      "phone_number_verified",
      "address",
      "updated_at",
      "cognito:mfa_enabled",
      "cognito:username",
    ];
    res.json({ UserPoolId, CSVHeader: headers });
  };
}
