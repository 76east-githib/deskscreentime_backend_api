import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import User from '@models/User';
import connectDB from "@database/connect-db";

interface Query {
  skip: number;
  limit: number;
  search: { [key: string]: { $regex: any; $options: string } }[];
}

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();
  let { startDate, endDate,  searchKeyword, sortBy, pageNo, size, } = req.body
  
  let query: Query = { skip: 0, limit: 10, search: [] };
  let sort: any = { createdAt: -1 };
  if (pageNo || size) {
    pageNo = parseInt(pageNo);
    size = parseInt(size);
    if (pageNo < 0 || pageNo === 0) {
      return res.status(200).json({ success: false, message: `Invalid page number, should start with 1` })
    }
    query.skip = size * (pageNo - 1)
    query.limit = size;
  }

  if (sortBy && sortBy.sortColumn && sortBy.sortDirection) {
    sort = { [sortBy.sortColumn]: sortBy.sortDirection }
  }
  if (searchKeyword && searchKeyword != '') { // to search keyword in email and firstName
    query.search.push(
      { 'email': { $regex: searchKeyword, "$options": "i" } },
      { 'fullname': { $regex: searchKeyword, "$options": "i" } },
      { 'companyName': { $regex: searchKeyword, "$options": "i" } }
    )
  }

  var start: any, end: any;
  if (startDate && startDate !== '') {
    start = startDate.split('T')[0]
  }
  if (endDate && endDate !== '') {
    end = endDate.split('T')[0]
  }

  let queryAnd: any = [
    { createdAt: { $lt: new Date(`${end}T23:59:59.999Z`) } },
    { role: 'company' }
  ]

  
  if (startDate && startDate !== '') {
    queryAnd.push({ createdAt: { $gte: new Date(`${start}T00:00:00.000Z`) } })
  }
  
  let match: any = {
    $and: queryAnd,
  }
  
  if (searchKeyword && searchKeyword != '') { // to search keyword in email and firstName
    match = {
      $and: queryAnd,
      $or: query.search
    }
  }

  try {
    let companyList = await User.aggregate([
      {
        $lookup: {
          from: 'projects',
					localField: '_id',
					foreignField: 'companyId',
					as: 'projects'
        }
      },
      {
        $lookup: {
          from: 'users',
					localField: '_id',
					foreignField: 'companyId',
					as: 'users'
        }
      },
      { $match: match },
      { $project: { 
          fullname: 1, email: 1, companyName: 1, role: 1, status: 1, mobile: 1, createdAt: 1, 
          projectsCount: { $size: "$projects" },
          usersCount: { $size: "$users" },
        } 
      },
      {
        $facet: {
          data: [
            { $sort: sort },
            { $skip: query.skip },
            { $limit: query.limit }
          ],
          metadata: [
            { $count: "total" }
          ]
        }
      }
    ])
    return res.status(200).json({ success: true, companyList })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable To Get Company List' })
  }
});

