require "fastimage"

module Jekyll
  class PhotoDimensionsGenerator < Generator
    priority :high

    def generate(site)
      photos = site.collections["photos"]
      return unless photos

      dimensions = {}
      photos.files.each do |file|
        size = FastImage.size(file.path)
        next unless size
        dimensions[file.basename] = { "width" => size[0], "height" => size[1] }
      end

      site.data["photo_dimensions"] = dimensions
    end
  end
end
