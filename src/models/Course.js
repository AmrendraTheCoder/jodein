// src/models/Course.js
// Course and Syllabus database schema.

import mongoose from 'mongoose'

const CourseSchema = new mongoose.Schema({
  collegeId: { type: String, required: true },
  courseId:  { type: String, required: true }, // e.g. "CS301"
  name:      { type: String, required: true }, // e.g. "Data Structures"
  program:   { type: String, required: true }, // e.g. "B.Tech"
  semester:  { type: Number, required: true }, // e.g. 3
  branch:    { type: String, required: true }, // e.g. "CSE"
  syllabus:  {
    description: { type: String },
    modules: [{
      title:  { type: String },
      topics: [{ type: String }],
      hours:  { type: Number }
    }],
    credits:     { type: Number }
  }
}, { timestamps: true })

// Compound unique index: same courseId cannot appear twice in the same college
CourseSchema.index({ collegeId: 1, courseId: 1 }, { unique: true })

export const Course = mongoose.model('Course', CourseSchema)
