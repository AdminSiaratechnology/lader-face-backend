const generateOTPTemplate = (otp) => {
return `
<div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
<div style="max-width: 500px; margin: auto; background: white; padding: 25px; border-radius: 10px; border: 1px solid #eee;">
<h2 style="text-align: center; color: #333;">🔐 Password Reset OTP</h2>
<p style="font-size: 15px; color: #555;">
Dear User,
<br/><br/>
You have requested to reset your password. Please use the OTP below to proceed.
</p>
<div style="text-align: center; margin: 25px 0;">
<div style="
display: inline-block;
padding: 12px 25px;
background: #007bff;
color: white;
font-size: 28px;
letter-spacing: 4px;
border-radius: 8px;">
<b>${otp}</b>
</div>
</div>
<p style="font-size: 14px; color: #777;">
This OTP is valid for <b>5 minutes</b>.
<br/>
If you did not request this, please ignore this email.
</p>
<hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;"/>
<p style="font-size: 12px; color: #999; text-align: center;">
© ${new Date().getFullYear()} Siara Technology. All rights reserved.
</p>
</div>
</div>
`;
};


module.exports = generateOTPTemplate;