import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import Project from '@models/Project';
import connectDB from "@database/connect-db";
import moment from 'moment-timezone';
const fs = require('fs');
const fse = require('fs-extra');

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  try {
    // get date 7 days before today date
    let date7daysBefore = moment().subtract(7, 'days').format('YYYYMMDD')

    // get all projects from DB
    let allProjectsId = await Project.find({}, { _id: 1, companyId: 1 }).sort({ "createdAt": -1 });

    // makes folder path format
    let foldersPaths: any = []
    allProjectsId && allProjectsId.forEach(element => {
      process.env.NEXT_PUBLIC_ENVIRONMENT == 'dev' ?
        foldersPaths.push(`${process.cwd()}/public/screenshots/${element.companyId}/${element._id}/${date7daysBefore}`)
        :
        foldersPaths.push(`${process.cwd()}/../../../76east/images/screenshots/${element.companyId}/${element._id}/${date7daysBefore}`)
    });

    // console.log('foldersPaths:', foldersPaths);

    // Check each folder path in the array
    let foldersExists: any = []
    foldersPaths && foldersPaths.forEach((folderPath: any) => {
      if (folderExists(folderPath)) {
        foldersExists.push(folderPath)
        // console.log(`${folderPath} exists.`);
      } else {
        console.log(`${folderPath} does not exist.`);
      }
    });
    // console.log('folders with path Exists:', foldersExists);
    

    if(foldersExists && foldersExists.length)  await removeNonEmptyFolders(foldersExists)

    return res.status(200).json({ success: true, message: "delete screenshots cron" });
  } catch (error) {
    console.log('error delete screenshot:', error)
    return res.status(500).json({
      success: false,
      message: 'Server encountered some error',
      error: error
    })
  }
});

// Remove each folder path in the array
async function removeNonEmptyFolders(foldersExists: any) {
  for (const folderPath of foldersExists) {
    await removeFolder(folderPath);
  }
}

// Function to remove a folder and its contents
async function removeFolder(folderPath: any) {
  try {
    await fse.remove(folderPath);
    // console.log(`${folderPath} removed successfully.`);
  } catch (error) {
    console.error(`Error removing ${folderPath}:`, error);
  }
}

// Function to check if a folder path exists
function folderExists(folderPath: any) {
  try {
    // Check if the folder exists
    fs.accessSync(folderPath, fs.constants.F_OK);
    return true;
  } catch (error) {
    // Folder doesn't exist or there's an error
    return false;
  }
}

