FROM nginx:alpine

# 把Runner已经构建出来的dist目录拷贝进去
COPY dist /usr/share/nginx/html

EXPOSE 80
# Nginx 默认启动命令即可