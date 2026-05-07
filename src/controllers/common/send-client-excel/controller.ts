import type { Request, Response } from 'express';
import { asyncHandler } from '@middleware/async-handler';
import { sendEmailWithAttachment } from '@helpers/sendEmailWithAttachment';
import connectDB from '@database/connect-db';

export const post = asyncHandler(async (req: Request, res: Response) => {
  await connectDB();

  try {
    const file = req.file as Express.Multer.File | undefined;
    const toField = (req.body?.to as string) || '';

    if (!file) {
      console.error("ERROR: File missing in FormData");
      return res.status(400).json({ success: false, message: 'No file received' });
    }

    if (!toField) {
      console.error("ERROR: 'To' clients missing in FormData");
      return res.status(400).json({ success: false, message: 'No clients selected' });
    }

    const to = (() => {
      try {
        return JSON.parse(toField);
      } catch {
        return toField.split(',').map((s) => s.trim()).filter(Boolean);
      }
    })();
    const fileName = file.originalname || 'report.xlsx';
    const buffer = file.buffer;

    await sendEmailWithAttachment({
      to,
      subject: 'Task Report',
      html: `
        <p>Hello,</p>
        <p>
          Your task report has been generated successfully.<br/>
          Please find the attached Excel report for your review.
        </p>
        <p>
          If you have any questions or need any modifications,
          feel free to contact us.
        </p>
        <br>
        <p>
          Regards,<br/>
          <strong>76east Team</strong>
        </p>
      `,
      filename: fileName,
      buffer,
    });

    return res.status(200).json({
      success: true,
      message: 'Mail Sent Successfully!',
    });
  } catch (err) {
    console.error('Email Send Error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error', error: err });
  }
});
